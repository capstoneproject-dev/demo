<?php
require_once __DIR__.'/bootstrap.php';
if(!isset($options['verify'])){
    $backup=$backupDir.'/before-printing-number-migration-'.date('Ymd-His').'.json';
    if(file_put_contents($backup,json_encode($pdo->query('SELECT * FROM print_jobs ORDER BY org_id,submitted_at,print_job_id')->fetchAll(PDO::FETCH_ASSOC),JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR))===false)throw new RuntimeException('Backup failed.');
    stEnsureSchema($pdo);
    $pdo->exec("UPDATE notification_email_deliveries d JOIN print_jobs pj ON pj.print_job_id=d.source_id AND pj.org_id=d.org_id SET d.message=CONCAT(d.message,' Request #',pj.request_number,'.') WHERE d.source_type='printing' AND d.delivery_status IN ('pending','retrying') AND d.message NOT LIKE '%request #%'");
    echo "Printing-row backup: $backup\n";
}
if((int)$pdo->query('SELECT COUNT(*) FROM print_jobs WHERE request_number IS NULL OR request_number=0')->fetchColumn())throw new RuntimeException('Printing requests remain unnumbered.');
if((int)$pdo->query('SELECT COUNT(*) FROM (SELECT org_id,request_number FROM print_jobs GROUP BY org_id,request_number HAVING COUNT(*)>1) duplicates')->fetchColumn())throw new RuntimeException('Duplicate organization reference numbers.');
if((int)$pdo->query('SELECT COUNT(*) FROM (SELECT org_id,MAX(request_number) AS maximum FROM print_jobs GROUP BY org_id) j LEFT JOIN printing_number_counters c ON c.org_id=j.org_id WHERE c.org_id IS NULL OR c.last_number<j.maximum')->fetchColumn())throw new RuntimeException('Printing counters are invalid.');
if((int)$pdo->query("SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('print_number_insert','print_number_update')")->fetchColumn()!==2)throw new RuntimeException('Printing numbering triggers are missing.');
echo json_encode($pdo->query('SELECT o.org_code,COUNT(*) AS requests,MIN(pj.request_number) AS first_number,MAX(pj.request_number) AS last_number FROM print_jobs pj JOIN organizations o ON o.org_id=pj.org_id GROUP BY pj.org_id,o.org_code ORDER BY pj.org_id')->fetchAll(PDO::FETCH_ASSOC),JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";
echo "Printing-number verification passed.\n";
