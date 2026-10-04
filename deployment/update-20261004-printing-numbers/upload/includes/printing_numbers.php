<?php
/** Permanent numeric references scoped to a printing organization. */
function stEnsurePrintingNumbers(PDO $pdo): void
{
    $pdo->exec('ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS request_number INT UNSIGNED NULL');
    $pdo->exec('CREATE TABLE IF NOT EXISTS printing_number_counters (
        org_id INT NOT NULL PRIMARY KEY,
        last_number INT UNSIGNED NOT NULL DEFAULT 0,
        CONSTRAINT fk_printing_number_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
    ) ENGINE=InnoDB');
    $maintenanceSupport = (bool)$pdo->query("SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='print_number_update' AND ACTION_STATEMENT LIKE '%capstone_printing_numbers_maintenance%'")->fetchColumn();
    $installed = $maintenanceSupport && (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('print_number_insert','print_number_update')")->fetchColumn() === 2
        && (int)$pdo->query("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='print_jobs' AND INDEX_NAME='uq_print_org_reference'")->fetchColumn() > 0;
    if ($installed && !$pdo->query('SELECT 1 FROM print_jobs WHERE request_number IS NULL LIMIT 1')->fetchColumn()) return;
    $lock = $pdo->query("SELECT GET_LOCK('capstone_printing_numbers_schema', 30)")->fetchColumn();
    if ((int)$lock !== 1) throw new RuntimeException('Printing numbering migration is busy.');
    try {
        // Preserve assigned references and recover the counter on repeat migration.
        $pdo->exec('INSERT INTO printing_number_counters (org_id,last_number)
            SELECT org_id, COALESCE(MAX(request_number),0) FROM print_jobs GROUP BY org_id
            ON DUPLICATE KEY UPDATE last_number=GREATEST(last_number,VALUES(last_number))');
        $trigger = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?');
        $allocate = 'INSERT INTO printing_number_counters (org_id,last_number) VALUES (NEW.org_id,1)
            ON DUPLICATE KEY UPDATE last_number=last_number+1;
            SET NEW.request_number=(SELECT last_number FROM printing_number_counters WHERE org_id=NEW.org_id);';
        foreach (['print_number_insert','print_number_update'] as $name) {
            $trigger->execute([$name]);
            if ((int)$trigger->fetchColumn() && ($name !== 'print_number_update' || $maintenanceSupport)) continue;
            if ($name === 'print_number_insert') {
                $pdo->exec("CREATE TRIGGER print_number_insert BEFORE INSERT ON print_jobs FOR EACH ROW BEGIN $allocate END");
            } else {
                // Unaccepted requests may move provider; their reference belongs to the accepting organization.
                $pdo->exec("CREATE OR REPLACE TRIGGER print_number_update BEFORE UPDATE ON print_jobs FOR EACH ROW BEGIN
                    IF IS_USED_LOCK('capstone_printing_numbers_maintenance') <=> CONNECTION_ID() THEN
                        SET NEW.request_number=NEW.request_number;
                    ELSEIF NEW.org_id <> OLD.org_id OR OLD.request_number IS NULL THEN $allocate
                    ELSEIF NOT (NEW.request_number <=> OLD.request_number) THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Printing reference numbers cannot be changed';
                    END IF;
                END");
            }
        }
        $pdo->beginTransaction();
        try {
            // Same lock order as all normal queue writers. Backfill oldest requests first.
            $orgs = $pdo->query('SELECT DISTINCT org_id FROM print_jobs WHERE request_number IS NULL ORDER BY org_id')->fetchAll(PDO::FETCH_COLUMN);
            stLockPrintingQueues($pdo, $orgs);
            $pdo->exec('UPDATE print_jobs SET request_number=NULL, updated_at=updated_at
                WHERE request_number IS NULL ORDER BY org_id,submitted_at,print_job_id');
            $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
        $index = $pdo->query("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='print_jobs' AND INDEX_NAME='uq_print_org_reference'")->fetchColumn();
        if (!(int)$index) $pdo->exec('ALTER TABLE print_jobs ADD UNIQUE KEY uq_print_org_reference (org_id,request_number)');
    } finally { $pdo->query("SELECT RELEASE_LOCK('capstone_printing_numbers_schema')"); }
}
