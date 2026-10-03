<?php
require_once __DIR__ . '/upload_security.php';
require_once __DIR__ . '/private_pdf_storage.php';
/**
 * Services tracker + printing queue domain services.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/notification_email_delivery.php';

class ServiceTrackerValidationException extends RuntimeException {}
class ServiceTrackerAuthorizationException extends RuntimeException {}
class ServiceTrackerConflictException extends RuntimeException {}

const ST_DEFAULT_SERVICES = [
    [
        'service_key' => 'services',
        'service_name' => 'Services',
        'description' => 'Master switch for enabling an organization to offer rentals.',
    ],
    [
        'service_key' => 'rentals',
        'service_name' => 'Rentals',
        'description' => 'Inventory-backed rentals and reservations.',
    ],
    [
        'service_key' => 'printing',
        'service_name' => 'Printing',
        'description' => 'Document printing queue and claim tracking.',
    ],
];

const ST_LOCKER_COLUMNS = ['A', 'B', 'C', 'D', 'E'];
const ST_LOCKER_ROWS_PER_COLUMN = 12;
const ST_LOCKER_SERVICE_KIND = 'locker';
const ST_LOCKER_PENDING = 'locker_pending';
const ST_LOCKER_ACTIVE = 'locker_active';
const ST_LOCKER_OVERDUE = 'locker_overdue';
const ST_LOCKER_RELEASED = 'locker_released';
const ST_LOCKER_REJECTED = 'locker_rejected';
const ST_LOCKER_NOTICE_MAX_LENGTH = 1000;
const ST_LOCKER_UPCOMING_NOTICE_WINDOW_DAYS = 7;
const ST_LOCKER_RELEASE_NOTICE_VISIBLE_DAYS = 14;

function stNormalizeServiceKey(string $serviceKey): string
{
    $normalized = strtolower(trim($serviceKey));
    $aliases = [
        'rental' => 'rentals',
        'print' => 'printing',
        'printer' => 'printing',
        'printing_services' => 'printing',
    ];
    return $aliases[$normalized] ?? $normalized;
}

function stRequireStudentContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new ServiceTrackerAuthorizationException('Not authenticated.');
    }
    $accountType = strtolower(trim((string)($session['account_type'] ?? 'student')));
    $loginRole = strtolower(trim((string)($session['login_role'] ?? 'student')));
    if ($accountType === 'osa_staff' || $loginRole === 'osa') {
        throw new ServiceTrackerAuthorizationException('Student context required.');
    }
    $userId = (int)($session['user_id'] ?? 0);
    if ($userId <= 0) {
        throw new ServiceTrackerAuthorizationException('Invalid student session.');
    }
    return [
        'session' => $session,
        'user_id' => $userId,
    ];
}

function stRequireOfficerContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new ServiceTrackerAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? '') !== 'org') {
        throw new ServiceTrackerAuthorizationException('Officer organization context required.');
    }
    $orgId = (int)($session['active_org_id'] ?? 0);
    if ($orgId <= 0) {
        throw new ServiceTrackerAuthorizationException('No active organization selected.');
    }
    return [
        'session' => $session,
        'user_id' => (int)($session['user_id'] ?? 0),
        'org_id' => $orgId,
    ];
}

function stRequireOsaContext(): array
{
    $session = getPhpSession();
    if (!isLoggedIn()) {
        throw new ServiceTrackerAuthorizationException('Not authenticated.');
    }
    if (($session['login_role'] ?? '') !== 'osa' && ($session['account_type'] ?? '') !== 'osa_staff') {
        throw new ServiceTrackerAuthorizationException('OSA context required.');
    }
    return [
        'session' => $session,
        'user_id' => (int)($session['user_id'] ?? 0),
    ];
}

function stEnsureSchema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }

    $pdo->exec(
        "ALTER TABLE organizations
         ADD COLUMN IF NOT EXISTS can_offer_printing TINYINT(1) NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS can_offer_services TINYINT(1) NOT NULL DEFAULT 1"
    );

    $pdo->exec(
        "ALTER TABLE inventory_items
         ADD COLUMN IF NOT EXISTS locker_monthly_rate DECIMAL(10,2) NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_semester_rate DECIMAL(10,2) NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_school_year_rate DECIMAL(10,2) NULL DEFAULT NULL"
    );

    $pdo->exec(
        "ALTER TABLE rentals
         ADD COLUMN IF NOT EXISTS service_kind VARCHAR(20) NOT NULL DEFAULT 'rental',
         ADD COLUMN IF NOT EXISTS locker_period_type VARCHAR(32) NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_period_quantity SMALLINT UNSIGNED NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_notice_sent_at DATETIME NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_notice_message TEXT NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_notice_sent_by_user_id INT NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_upcoming_notice_sent_at DATETIME NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_upcoming_notice_message TEXT NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS locker_upcoming_notice_sent_by_user_id INT NULL DEFAULT NULL"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS print_jobs (
            print_job_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            org_id INT NOT NULL,
            user_id INT NOT NULL,
            provider_auto_assigned TINYINT(1) NOT NULL DEFAULT 0,
            provider_accepted_at DATETIME NULL,
            file_name VARCHAR(255) NOT NULL,
            file_url VARCHAR(255) NOT NULL,
            notes TEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'queued',
            queue_order INT NOT NULL DEFAULT 1,
            submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processing_started_at DATETIME NULL,
            ready_at DATETIME NULL,
            claimed_at DATETIME NULL,
            total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            payment_status VARCHAR(16) NOT NULL DEFAULT 'unpaid',
            paid_at DATETIME NULL,
            paid_by_user_id INT NULL,
            last_updated_by_user_id INT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_print_jobs_org_status_order (org_id, status, queue_order, submitted_at),
            KEY idx_print_jobs_user_status (user_id, status, submitted_at),
            CONSTRAINT fk_print_jobs_org
                FOREIGN KEY (org_id) REFERENCES organizations(org_id)
                ON DELETE CASCADE,
            CONSTRAINT fk_print_jobs_user
                FOREIGN KEY (user_id) REFERENCES users(user_id)
                ON DELETE CASCADE,
            CONSTRAINT fk_print_jobs_paid_by
                FOREIGN KEY (paid_by_user_id) REFERENCES users(user_id)
                ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $pdo->exec(
        "ALTER TABLE print_jobs
         ADD COLUMN IF NOT EXISTS provider_auto_assigned TINYINT(1) NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS provider_accepted_at DATETIME NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
         ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL DEFAULT NULL,
         ADD COLUMN IF NOT EXISTS paid_by_user_id INT NULL DEFAULT NULL"
    );

    // Preserve the legacy behavior for rows created before printing payments
    // were tracked: claimed jobs were historically reported as paid.
    $pdo->exec(
        "UPDATE print_jobs
         SET paid_at = CASE
                 WHEN status = 'claimed' THEN COALESCE(paid_at, claimed_at)
                 ELSE paid_at
             END,
             payment_status = CASE
                 WHEN status = 'claimed' THEN 'paid'
                 WHEN status = 'cancelled' THEN 'waived'
                 ELSE 'unpaid'
             END
         WHERE payment_status IS NULL OR payment_status = ''"
    );
    $pdo->exec(
        "ALTER TABLE print_jobs
         MODIFY COLUMN payment_status VARCHAR(16) NOT NULL DEFAULT 'unpaid'"
    );

    $fkStmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.REFERENTIAL_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE()
           AND TABLE_NAME = 'print_jobs'
           AND CONSTRAINT_NAME = 'fk_print_jobs_paid_by'"
    );
    $fkStmt->execute();
    if ((int)$fkStmt->fetchColumn() === 0) {
        $pdo->exec(
            "ALTER TABLE print_jobs
             ADD CONSTRAINT fk_print_jobs_paid_by
             FOREIGN KEY (paid_by_user_id) REFERENCES users(user_id)
             ON DELETE SET NULL"
        );
    }

    $indexStmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'print_jobs'
           AND INDEX_NAME = 'idx_print_jobs_user_org_payment'"
    );
    $indexStmt->execute();
    if ((int)$indexStmt->fetchColumn() === 0) {
        $pdo->exec(
            "ALTER TABLE print_jobs
             ADD INDEX idx_print_jobs_user_org_payment
                (user_id, org_id, status, payment_status)"
        );
    }

    $done = true;
}

function stGetLockerCodes(): array
{
    $codes = [];
    foreach (ST_LOCKER_COLUMNS as $column) {
        for ($index = 1; $index <= ST_LOCKER_ROWS_PER_COLUMN; $index++) {
            $codes[] = sprintf('%s%02d', $column, $index);
        }
    }
    return $codes;
}

function stNormalizeLockerCode(string $code): string
{
    return strtoupper(trim($code));
}

function stIsSscOrg(PDO $pdo, int $orgId): bool
{
    if ($orgId <= 0) {
        return false;
    }

    $stmt = $pdo->prepare(
        "SELECT 1
         FROM organizations
         WHERE org_id = :org_id
           AND status = 'active'
           AND (
                UPPER(TRIM(COALESCE(org_code, ''))) = 'SSC'
                OR LOWER(TRIM(COALESCE(org_name, ''))) = 'supreme student council'
           )
         LIMIT 1"
    );
    $stmt->execute([':org_id' => $orgId]);
    return (bool)$stmt->fetchColumn();
}

function stResolveStudentOrganization(PDO $pdo): ?array
{
    $session = getPhpSession();
    $orgId = (int)($session['mapped_org_id'] ?? ($session['active_org_id'] ?? 0));
    if ($orgId > 0) {
        $stmt = $pdo->prepare(
            "SELECT org_id, org_name, org_code, logo_url, status
             FROM organizations
             WHERE org_id = :org_id
             LIMIT 1"
        );
        $stmt->execute([':org_id' => $orgId]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }

    $orgRef = trim((string)($session['mapped_org_name'] ?? ($session['active_org_name'] ?? '')));
    if ($orgRef === '') {
        return null;
    }

    $stmt = $pdo->prepare(
        "SELECT org_id, org_name, org_code, logo_url, status
         FROM organizations
         WHERE LOWER(TRIM(org_code)) = LOWER(TRIM(:org_ref))
            OR LOWER(TRIM(org_name)) = LOWER(TRIM(:org_ref))
         ORDER BY org_id ASC
         LIMIT 1"
    );
    $stmt->execute([':org_ref' => $orgRef]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function stResolveSscOrg(PDO $pdo): ?array
{
    $stmt = $pdo->query(
        "SELECT org_id, org_name, org_code, status
         FROM organizations
         WHERE UPPER(TRIM(org_code)) = 'SSC'
            OR LOWER(TRIM(org_name)) = 'supreme student council'
         ORDER BY org_id ASC
         LIMIT 1"
    );
    $row = $stmt->fetch();
    return $row ?: null;
}

function stRequireLockerOfficerContext(PDO $pdo): array
{
    $context = stRequireOfficerContext();
    if (!stIsSscOrg($pdo, (int)$context['org_id'])) {
        throw new ServiceTrackerAuthorizationException('Locker services are only available for active organization officers.');
    }
    return $context;
}

function stGetOrCreateLockerCategoryId(PDO $pdo, int $orgId): int
{
    $stmt = $pdo->prepare(
        "SELECT category_id
         FROM inventory_categories
         WHERE org_id = :org_id
           AND LOWER(TRIM(category_name)) = 'locker'
         ORDER BY category_id ASC
         LIMIT 1"
    );
    $stmt->execute([':org_id' => $orgId]);
    $existingId = (int)$stmt->fetchColumn();
    if ($existingId > 0) {
        return $existingId;
    }

    $insert = $pdo->prepare(
        "INSERT INTO inventory_categories (org_id, category_name, is_active)
         VALUES (:org_id, 'Locker', 1)"
    );
    $insert->execute([':org_id' => $orgId]);
    return (int)$pdo->lastInsertId();
}

function stEnsureLockerInventory(PDO $pdo, int $orgId): void
{
    stEnsureSchema($pdo);
    if (!stIsSscOrg($pdo, $orgId)) {
        return;
    }

    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $existingStmt = $pdo->prepare(
        "SELECT item_name, item_id
         FROM inventory_items
         WHERE org_id = :org_id
           AND category_id = :category_id"
    );
    $existingStmt->execute([
        ':org_id' => $orgId,
        ':category_id' => $categoryId,
    ]);
    $existing = [];
    foreach ($existingStmt->fetchAll() as $row) {
        $existing[stNormalizeLockerCode((string)$row['item_name'])] = (int)$row['item_id'];
    }

    $insert = $pdo->prepare(
        "INSERT INTO inventory_items
            (org_id, item_name, barcode, image_path, category_id, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status, locker_monthly_rate, locker_semester_rate, locker_school_year_rate)
         VALUES
            (:org_id, :item_name, :barcode, NULL, :category_id, 0.00, NULL, NULL, 'available', 0.00, 0.00, 0.00)"
    );

    foreach (stGetLockerCodes() as $lockerCode) {
        if (isset($existing[$lockerCode])) {
            continue;
        }
        $insert->execute([
            ':org_id' => $orgId,
            ':item_name' => $lockerCode,
            ':barcode' => $lockerCode,
            ':category_id' => $categoryId,
        ]);
    }
}

function stSeedDefaultServices(PDO $pdo): void
{
    stEnsureSchema($pdo);
}

function stSeedDefaultAuthorizations(PDO $pdo): void
{
    stEnsureSchema($pdo);
}

function stListServiceCatalog(PDO $pdo): array
{
    stEnsureSchema($pdo);
    return array_map(static function (array $service): array {
        return [
            'service_key' => (string)$service['service_key'],
            'service_name' => (string)$service['service_name'],
            'description' => (string)($service['description'] ?? ''),
            'is_active' => true,
        ];
    }, ST_DEFAULT_SERVICES);
}

function stListAuthorizedOrganizations(PDO $pdo, string $serviceKey): array
{
    stEnsureSchema($pdo);
    $serviceKey = stNormalizeServiceKey($serviceKey);

    if ($serviceKey === 'printing') {
        $stmt = $pdo->query(
            "SELECT o.org_id, o.org_name, o.org_code, o.logo_url
             FROM organizations o
             WHERE o.status = 'active'
               AND COALESCE(o.can_offer_printing, 0) = 1
             ORDER BY o.org_name ASC"
        );
    } else {
        $stmt = $pdo->query(
            "SELECT o.org_id, o.org_name, o.org_code, o.logo_url
             FROM organizations o
             WHERE o.status = 'active'
               AND COALESCE(o.can_offer_services, 1) = 1
             ORDER BY o.org_name ASC"
        );
    }

    return array_map(static function (array $row): array {
        return [
            'org_id' => (int)$row['org_id'],
            'org_name' => (string)$row['org_name'],
            'org_code' => (string)($row['org_code'] ?? ''),
            'logo_url' => (string)($row['logo_url'] ?? ''),
        ];
    }, $stmt->fetchAll());
}

function stGetAuthorizedOrgIds(PDO $pdo, string $serviceKey): array
{
    $orgs = stListAuthorizedOrganizations($pdo, $serviceKey);
    return array_map(static fn(array $org): int => (int)$org['org_id'], $orgs);
}

function stServiceEnabledForOrg(PDO $pdo, int $orgId, string $serviceKey): bool
{
    stEnsureSchema($pdo);
    $serviceKey = stNormalizeServiceKey($serviceKey);
    if ($orgId <= 0 || $serviceKey === '') {
        return false;
    }

    if ($serviceKey === 'printing') {
        $stmt = $pdo->prepare(
            "SELECT 1
             FROM organizations
             WHERE org_id = :org_id
               AND status = 'active'
               AND COALESCE(can_offer_printing, 0) = 1
             LIMIT 1"
        );
        $stmt->execute([':org_id' => $orgId]);
        return (bool)$stmt->fetchColumn();
    }

    $stmt = $pdo->prepare(
        "SELECT 1
         FROM organizations
         WHERE org_id = :org_id
           AND status = 'active'
           AND COALESCE(can_offer_services, 1) = 1
         LIMIT 1"
    );
    $stmt->execute([':org_id' => $orgId]);
    return (bool)$stmt->fetchColumn();
}

function stListOrganizationsWithServices(PDO $pdo): array
{
    stEnsureSchema($pdo);
    $services = stListServiceCatalog($pdo);

    $orgStmt = $pdo->query(
        "SELECT org_id, org_name, org_code, status,
                COALESCE(can_offer_printing, 0) AS can_offer_printing,
                COALESCE(can_offer_services, 1) AS can_offer_services
         FROM organizations
         ORDER BY org_name ASC"
    );
    $orgs = [];
    foreach ($orgStmt->fetchAll() as $row) {
        $orgs[(int)$row['org_id']] = [
            'org_id' => (int)$row['org_id'],
            'org_name' => (string)$row['org_name'],
            'org_code' => (string)($row['org_code'] ?? ''),
            'status' => (string)($row['status'] ?? ''),
            'services' => [
                'services' => ((int)($row['can_offer_services'] ?? 1) === 1),
                'rentals' => ((string)($row['status'] ?? '') === 'active') && ((int)($row['can_offer_services'] ?? 1) === 1),
                'printing' => ((int)($row['can_offer_printing'] ?? 0) === 1),
            ],
        ];
    }

    return [
        'service_catalog' => $services,
        'organizations' => array_values($orgs),
    ];
}

function stSaveOrganizationServiceAuthorizations(PDO $pdo, int $orgId, array $services, int $updatedByUserId): array
{
    stEnsureSchema($pdo);
    if ($orgId <= 0) {
        throw new ServiceTrackerValidationException('A valid organization is required.');
    }

    $stmt = $pdo->prepare(
        "UPDATE organizations
         SET can_offer_printing = :can_offer_printing,
             can_offer_services = :can_offer_services
         WHERE org_id = :org_id"
    );
    $stmt->execute([
        ':can_offer_printing' => !empty($services['printing']) ? 1 : 0,
        ':can_offer_services' => array_key_exists('services', $services) ? (!empty($services['services']) ? 1 : 0) : 1,
        ':org_id' => $orgId,
    ]);

    $all = stListOrganizationsWithServices($pdo);
    foreach ($all['organizations'] as $org) {
        if ((int)$org['org_id'] === $orgId) {
            return $org;
        }
    }

    throw new RuntimeException('Organization not found after update.');
}

function stResolveOrganizationByRef(PDO $pdo, $orgRef): ?array
{
    stEnsureSchema($pdo);
    if (is_numeric($orgRef)) {
        $stmt = $pdo->prepare(
            "SELECT org_id, org_name, org_code, status
             FROM organizations
             WHERE org_id = :org_id
             LIMIT 1"
        );
        $stmt->execute([':org_id' => (int)$orgRef]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    $trimmed = trim((string)$orgRef);
    if ($trimmed === '') {
        return null;
    }

    $stmt = $pdo->prepare(
        "SELECT org_id, org_name, org_code, status
         FROM organizations
         WHERE LOWER(TRIM(org_code)) = LOWER(TRIM(:org_ref))
            OR LOWER(TRIM(org_name)) = LOWER(TRIM(:org_ref))
         ORDER BY org_id ASC
         LIMIT 1"
    );
    $stmt->execute([':org_ref' => $trimmed]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function stStoreUploadedPrintFile(array $file): array
{
    try {
        $stored = privatePdfStoreUploadedFile(
            $file,
            'print-jobs',
            20 * 1024 * 1024,
            ['pdf', 'docx', 'png', 'jpg', 'jpeg']
        );
    } catch (UploadValidationException $e) {
        throw new ServiceTrackerValidationException($e->getMessage(), 0, $e);
    }

    return [
        'file_name' => $stored['original_name'],
        'file_url' => $stored['storage_key'],
    ];
}

function stRequirePrintingTransactionOwner(PDO $pdo): void
{
    if ($pdo->inTransaction()) {
        throw new LogicException('Printing operations require their own transaction.');
    }
}

/** All printing queue writers lock organizations first, in ascending ID order. */
function stBeginPrintingTransaction(PDO $pdo): void
{
    stRequirePrintingTransactionOwner($pdo);
    // Avoid locking index gaps between independent providers' empty queues.
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    $pdo->beginTransaction();
}

function stLockPrintingQueues(PDO $pdo, array $orgIds): void
{
    if (!$pdo->inTransaction()) {
        throw new LogicException('Printing queue locks require a transaction.');
    }
    $orgIds = array_unique(array_map('intval', $orgIds));
    sort($orgIds, SORT_NUMERIC);
    $lock = $pdo->prepare('SELECT org_id FROM organizations WHERE org_id = ? FOR UPDATE');
    foreach ($orgIds as $orgId) {
        $lock->execute([$orgId]);
        if (!$lock->fetchColumn()) {
            throw new ServiceTrackerValidationException('Printing provider not found.');
        }
    }
}

function stIsPrintingConcurrencyError(PDOException $e): bool
{
    return (string)$e->getCode() === '40001'
        || in_array((int)($e->errorInfo[1] ?? 0), [1205, 1213], true)
        || ((int)($e->errorInfo[1] ?? 0) === 1062
            && str_contains((string)($e->errorInfo[2] ?? ''), 'uq_print_current_queue'));
}

function stIsRentalConstraintConflict(PDOException $e): bool
{
    return (int)($e->errorInfo[1] ?? 0) === 1062
        && (str_contains((string)($e->errorInfo[2] ?? ''), 'uq_current_locker_student')
            || str_contains((string)($e->errorInfo[2] ?? ''), 'uq_current_locker_item'));
}

function stIsLockerConcurrencyError(PDOException $e): bool
{
    return in_array((int)($e->errorInfo[1] ?? 0), [1205, 1213], true)
        || stIsRentalConstraintConflict($e);
}

/** Retain the existing locking workflow until the deployment migration runs. */
function stInsertLockerRental(PDO $pdo, int $itemId, array $params): int
{
    if (!$pdo->inTransaction()) {
        throw new LogicException('Locker insertion requires a transaction.');
    }
    $hasIdentity = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'rentals' AND column_name = 'locker_item_id'")->fetchColumn();
    $column = $hasIdentity ? ', locker_item_id' : '';
    $value = $hasIdentity ? ', :locker_item_id' : '';
    if ($hasIdentity) $params[':locker_item_id'] = $itemId;
    $insert = $pdo->prepare("INSERT INTO rentals
        (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time,
         total_cost, payment_status, status, service_kind, locker_period_type, locker_period_quantity{$column})
        VALUES (:org_id, :user_id, :processed_by_user_id, :rent_time, :expected_return_time,
         :total_cost, 'unpaid', :status, :service_kind, :locker_period_type, :locker_period_quantity{$value})");
    $insert->execute($params);
    return (int)$pdo->lastInsertId();
}

function stGetNextQueueOrder(PDO $pdo, int $orgId): int
{
    stLockPrintingQueues($pdo, [$orgId]);
    // A locking read sees the latest committed queue even under REPEATABLE READ.
    $stmt = $pdo->prepare(
        "SELECT queue_order
         FROM print_jobs
         WHERE org_id = :org_id
           AND status = 'queued'
         ORDER BY queue_order DESC, submitted_at DESC, print_job_id DESC
         LIMIT 1 FOR UPDATE"
    );
    $stmt->execute([':org_id' => $orgId]);
    $lastOrder = (int)$stmt->fetchColumn();
    if ($lastOrder >= 2147483647) {
        throw new ServiceTrackerValidationException('The printing queue has reached its supported limit.');
    }
    return max(1, $lastOrder + 1);
}

function stNormalizeQueuedOrders(PDO $pdo, int $orgId): void
{
    stLockPrintingQueues($pdo, [$orgId]);
    $stmt = $pdo->prepare(
        "SELECT print_job_id
         FROM print_jobs
         WHERE org_id = :org_id
           AND status = 'queued'
         ORDER BY queue_order ASC, submitted_at ASC, print_job_id ASC
         FOR UPDATE"
    );
    $stmt->execute([':org_id' => $orgId]);
    $jobs = $stmt->fetchAll();

    if (!$jobs) {
        return;
    }

    stWriteQueuedOrders($pdo, $orgId, array_map(static fn(array $job): int => (int)$job['print_job_id'], $jobs));
}

/** Caller has locked the complete queue; stage in unused positive positions. */
function stWriteQueuedOrders(PDO $pdo, int $orgId, array $jobIds): void
{
    stLockPrintingQueues($pdo, [$orgId]);
    if (!$jobIds) return;
    $read = $pdo->prepare("SELECT print_job_id, queue_order FROM print_jobs
        WHERE org_id = ? AND status = 'queued' FOR UPDATE");
    $read->execute([$orgId]);
    $rows = $read->fetchAll();
    $currentIds = array_map(static fn(array $row): int => (int)$row['print_job_id'], $rows);
    $requestedIds = $jobIds;
    sort($currentIds, SORT_NUMERIC);
    sort($requestedIds, SORT_NUMERIC);
    if ($currentIds !== $requestedIds) {
        throw new ServiceTrackerConflictException('The printing queue changed. Refresh and try again.');
    }
    $maximum = max(count($jobIds), ...array_map(static fn(array $row): int => (int)$row['queue_order'], $rows));
    // Leave room for every staged row without overflowing PHP or SQL BIGINT.
    if ($maximum > PHP_INT_MAX - count($jobIds)) {
        throw new ServiceTrackerValidationException('The printing queue has reached its supported limit.');
    }
    if ($maximum > 2147483647 - count($jobIds)) {
        $type = $pdo->query("SELECT data_type FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'print_jobs' AND column_name = 'queue_order'")->fetchColumn();
        if ($type !== 'bigint') {
            throw new ServiceTrackerValidationException('The printing queue has reached its supported limit.');
        }
    }
    $update = $pdo->prepare("UPDATE print_jobs SET queue_order = ?
        WHERE print_job_id = ? AND org_id = ? AND status = 'queued'");
    foreach ($jobIds as $index => $jobId) {
        $update->execute([$maximum + $index + 1, $jobId, $orgId]);
        if ($update->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('The printing queue changed. Refresh and try again.');
        }
    }
    foreach ($jobIds as $index => $jobId) {
        $update->execute([$index + 1, $jobId, $orgId]);
        if ($update->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('The printing queue changed. Refresh and try again.');
        }
    }
}

function stFetchPrintJob(PDO $pdo, int $printJobId): array
{
    stEnsureSchema($pdo);
    $stmt = $pdo->prepare(
        "SELECT pj.*,
                o.org_name,
                o.org_code,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
                u.student_number,
                NULL AS section
         FROM print_jobs pj
         JOIN organizations o ON o.org_id = pj.org_id
         JOIN users u ON u.user_id = pj.user_id
         WHERE pj.print_job_id = :print_job_id
         LIMIT 1"
    );
    $stmt->execute([':print_job_id' => $printJobId]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new RuntimeException('Print job not found.');
    }
    $rows = stAttachQueuePositions($pdo, [$row]);
    return $rows[0];
}

function stPrintingJobStateVersion(array $row): string
{
    $state = [];
    foreach (['print_job_id', 'org_id', 'status', 'provider_auto_assigned', 'provider_accepted_at',
        'processing_started_at', 'ready_at', 'claimed_at', 'queue_order', 'total_cost',
        'payment_status', 'paid_at', 'paid_by_user_id', 'last_updated_by_user_id', 'updated_at'] as $field) {
        $state[$field] = isset($row[$field]) ? (string)$row[$field] : null;
    }
    return hash('sha256', json_encode($state, JSON_THROW_ON_ERROR));
}

function stAttachQueuePositions(PDO $pdo, array $rows): array
{
    $queuedOrgIds = [];
    foreach ($rows as $row) {
        if (strtolower((string)($row['status'] ?? '')) === 'queued') {
            $queuedOrgIds[(int)$row['org_id']] = true;
        }
    }

    $positionMap = [];
    if ($queuedOrgIds) {
        $orgIds = array_keys($queuedOrgIds);
        $placeholders = implode(',', array_fill(0, count($orgIds), '?'));
        $stmt = $pdo->prepare(
            "SELECT print_job_id, org_id
             FROM print_jobs
             WHERE status = 'queued'
               AND org_id IN ($placeholders)
             ORDER BY org_id ASC, queue_order ASC, submitted_at ASC, print_job_id ASC"
        );
        $stmt->execute($orgIds);
        $positions = [];
        foreach ($stmt->fetchAll() as $queued) {
            $orgId = (int)$queued['org_id'];
            if (!isset($positions[$orgId])) {
                $positions[$orgId] = 0;
            }
            $positions[$orgId]++;
            $positionMap[(int)$queued['print_job_id']] = $positions[$orgId];
        }
    }

    foreach ($rows as &$row) {
        $row['state_version'] = stPrintingJobStateVersion($row);
        $row['print_job_id'] = (int)$row['print_job_id'];
        $row['org_id'] = (int)$row['org_id'];
        $row['user_id'] = (int)$row['user_id'];
        $row['queue_order'] = (int)$row['queue_order'];
        $row['provider_auto_assigned'] = (int)($row['provider_auto_assigned'] ?? 0);
        $row['total_cost'] = (float)($row['total_cost'] ?? 0);
        $row['payment_status'] = strtolower((string)($row['payment_status'] ?? 'unpaid'));
        $row['paid_by_user_id'] = isset($row['paid_by_user_id']) ? (int)$row['paid_by_user_id'] : null;
        $row['queue_position'] = strtolower((string)$row['status']) === 'queued'
            ? (int)($positionMap[(int)$row['print_job_id']] ?? 0)
            : null;
        $row = privatePdfDecoratePrintJobRow($row);
    }

    return $rows;
}

function stSubmitPrintJob(PDO $pdo, int $userId, array $data, array $file): array
{
    stRequirePrintingTransactionOwner($pdo);
    stEnsureSchema($pdo);
    if ($userId <= 0) {
        throw new ServiceTrackerValidationException('Invalid student account.');
    }

    $orgRef = $data['org_id'] ?? ($data['org_code'] ?? ($data['org_name'] ?? ''));
    $notes = trim((string)($data['notes'] ?? ''));

    $autoAssigned = 0;
    $org = stResolveOrganizationByRef($pdo, $orgRef);
    if (!$org) {
        $autoAssigned = 1;
        $authorized = array_values(array_filter(
            stListAuthorizedOrganizations($pdo, 'printing'),
            static fn(array $candidate): bool => !stHasUnpaidPrintingBalance($pdo, $userId, (int)$candidate['org_id'])
        ));
        if (!$authorized) {
            throw new ServiceTrackerValidationException('You have an unpaid printing balance with every available provider. Settle a balance before submitting another print request.');
        }

        $fallback = null;
        foreach ($authorized as $candidate) {
            if (strtoupper(trim((string)($candidate['org_code'] ?? ''))) === 'SSC') {
                $fallback = $candidate;
                break;
            }
        }
        if ($fallback === null) {
            $fallback = $authorized[0];
        }

        $org = [
            'org_id' => (int)$fallback['org_id'],
            'org_name' => (string)$fallback['org_name'],
            'org_code' => (string)($fallback['org_code'] ?? ''),
            'status' => 'active',
        ];
    }

    $orgId = (int)$org['org_id'];

    if (!stServiceEnabledForOrg($pdo, $orgId, 'printing')) {
        throw new ServiceTrackerValidationException('Selected organization is not authorized for printing services.');
    }
    if (stHasUnpaidPrintingBalance($pdo, $userId, $orgId)) {
        throw new ServiceTrackerValidationException('You have an unpaid printing balance with this organization. Choose another provider or settle the balance first.');
    }

    $storedFile = stStoreUploadedPrintFile($file);

    try {
        stBeginPrintingTransaction($pdo);
        $queueOrder = stGetNextQueueOrder($pdo, $orgId);
        $insert = $pdo->prepare(
            "INSERT INTO print_jobs
                (org_id, user_id, provider_auto_assigned, file_name, file_url, notes, status, queue_order, last_updated_by_user_id)
             VALUES
                (:org_id, :user_id, :provider_auto_assigned, :file_name, :file_url, :notes, 'queued', :queue_order, :updated_by)"
        );
        $insert->execute([
            ':org_id' => $orgId,
            ':user_id' => $userId,
            ':provider_auto_assigned' => $autoAssigned,
            ':file_name' => $storedFile['file_name'],
            ':file_url' => $storedFile['file_url'],
            ':notes' => $notes !== '' ? $notes : null,
            ':queue_order' => $queueOrder,
            ':updated_by' => $userId,
        ]);
        $printJobId = (int)$pdo->lastInsertId();
        // Read the result before committing: read failures must roll back the insert.
        $result = stFetchPrintJob($pdo, $printJobId);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        privatePdfDeleteStorageKey((string)$storedFile['file_url']);
        throw $e;
    }
    return $result;
}

function stHasUnpaidPrintingBalance(PDO $pdo, int $userId, int $orgId): bool
{
    if ($userId <= 0 || $orgId <= 0) {
        return false;
    }

    $stmt = $pdo->prepare(
        "SELECT 1
         FROM print_jobs
         WHERE user_id = :user_id
           AND org_id = :org_id
           AND status = 'claimed'
           AND payment_status = 'unpaid'
           AND total_cost > 0
         LIMIT 1"
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':org_id' => $orgId,
    ]);
    return (bool)$stmt->fetchColumn();
}

function stRequireActiveOfficerIdentifier(PDO $pdo, int $orgId, string $identifier): int
{
    $identifier = trim($identifier);
    if ($identifier === '') {
        throw new ServiceTrackerValidationException('Scan a valid officer barcode before marking the payment as paid.');
    }

    $stmt = $pdo->prepare(
        "SELECT u.user_id, u.student_number, u.employee_number, u.email
         FROM users u
         JOIN organization_members om
           ON om.user_id = u.user_id
          AND om.org_id = :org_id
          AND om.is_active = 1
         JOIN org_roles role
           ON role.role_id = om.role_id
          AND role.is_active = 1
          AND role.can_access_org_dashboard = 1
         WHERE u.is_active = 1"
    );
    $stmt->execute([':org_id' => $orgId]);
    $scanned = strtolower($identifier);
    foreach ($stmt->fetchAll() as $officer) {
        $identifiers = array_filter([
            trim((string)($officer['student_number'] ?? '')),
            trim((string)($officer['employee_number'] ?? '')),
            trim((string)($officer['email'] ?? '')),
        ]);
        foreach ($identifiers as $rawIdentifier) {
            if (strtolower($rawIdentifier) === $scanned
                || strtolower(stEncodeBarcodeReference($rawIdentifier, 'O')) === $scanned
                || strtolower(stEncodeBarcodeReference($rawIdentifier, 'S')) === $scanned) {
                return (int)$officer['user_id'];
            }
        }
    }

    throw new ServiceTrackerValidationException('Unknown officer ID. Scan a valid active officer barcode for this organization.');
}

function stEncodeBarcodeReference(string $raw, string $prefix): string
{
    if ($raw === '') {
        return '';
    }

    $hash = 0;
    $length = strlen($raw);
    for ($index = 0; $index < $length; $index++) {
        $hash = (($hash << 5) - $hash) + ord($raw[$index]);
        $hash &= 0xFFFFFFFF;
        if ($hash >= 0x80000000) {
            $hash -= 0x100000000;
        }
    }

    $number = abs($hash);
    $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    $encoded = '';
    for ($index = 0; $index < 4; $index++) {
        $encoded = $characters[$number % 62] . $encoded;
        $number = intdiv($number, 62);
    }
    return $prefix . $encoded;
}

function stListPrintJobs(PDO $pdo, array $filters = [], ?int $userScope = null, ?int $orgScope = null): array
{
    stEnsureSchema($pdo);
    $where = [];
    $params = [];

    if (!empty($filters['exclude_provider_auto_assigned'])) {
        $where[] = 'COALESCE(pj.provider_auto_assigned, 0) = 0';
    }

    if ($userScope !== null) {
        $where[] = 'pj.user_id = :user_id';
        $params[':user_id'] = $userScope;
    }
    if ($orgScope !== null) {
        $where[] = 'pj.org_id = :org_id';
        $params[':org_id'] = $orgScope;
    }

    $status = strtolower(trim((string)($filters['status'] ?? 'open')));
    if ($status === 'open') {
        $where[] = "pj.status IN ('queued', 'processing', 'ready_to_claim')";
    } elseif ($status !== '' && $status !== 'all') {
        $where[] = 'pj.status = :status';
        $params[':status'] = $status;
    }

    $sql = "SELECT pj.*,
                   o.org_name,
                   o.org_code,
                   CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
                   u.student_number,
                   NULL AS section
            FROM print_jobs pj
            JOIN organizations o ON o.org_id = pj.org_id
            JOIN users u ON u.user_id = pj.user_id
            " . (count($where) ? 'WHERE ' . implode(' AND ', $where) : '') . "
            ORDER BY
                CASE pj.status
                    WHEN 'processing' THEN 0
                    WHEN 'queued' THEN 1
                    WHEN 'ready_to_claim' THEN 2
                    WHEN 'claimed' THEN 3
                    WHEN 'cancelled' THEN 4
                    ELSE 5
                END,
                CASE WHEN pj.status = 'queued' THEN pj.queue_order ELSE 0 END ASC,
                pj.submitted_at DESC,
                pj.print_job_id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    return stAttachQueuePositions($pdo, $rows);
}

function stListPendingPrintJobs(PDO $pdo): array
{
    stEnsureSchema($pdo);
    $stmt = $pdo->prepare(
        "SELECT pj.*,
                o.org_name,
                o.org_code,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
                u.student_number,
                NULL AS section
         FROM print_jobs pj
         JOIN organizations o ON o.org_id = pj.org_id
         JOIN users u ON u.user_id = pj.user_id
         WHERE COALESCE(pj.provider_auto_assigned, 0) = 1
           AND pj.status = 'queued'
         ORDER BY pj.submitted_at ASC, pj.print_job_id ASC"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();
    return stAttachQueuePositions($pdo, $rows);
}

function stAcceptPendingPrintJob(PDO $pdo, int $orgId, int $printJobId, int $updatedByUserId): array
{
    stRequirePrintingTransactionOwner($pdo);
    stEnsureSchema($pdo);
    if ($orgId <= 0) {
        throw new ServiceTrackerValidationException('A valid organization is required.');
    }
    if ($printJobId <= 0) {
        throw new ServiceTrackerValidationException('A valid print job is required.');
    }

    if (!stServiceEnabledForOrg($pdo, $orgId, 'printing')) {
        throw new ServiceTrackerAuthorizationException('Your organization is not authorized for printing services.');
    }

    // Discover the source without taking a job lock ahead of the queue locks.
    $sourceQuery = $pdo->prepare('SELECT org_id FROM print_jobs WHERE print_job_id = ?');
    $sourceQuery->execute([$printJobId]);
    $source = $sourceQuery->fetch();
    if (!$source) {
        throw new ServiceTrackerValidationException('Print job not found.');
    }
    stBeginPrintingTransaction($pdo);
    try {
        stLockPrintingQueues($pdo, [(int)$source['org_id'], $orgId]);
        $lock = $pdo->prepare(
            "SELECT org_id, provider_auto_assigned, status, user_id
             FROM print_jobs
             WHERE print_job_id = :print_job_id
             FOR UPDATE"
        );
        $lock->execute([':print_job_id' => $printJobId]);
        $current = $lock->fetch();
        if (!$current) {
            throw new ServiceTrackerValidationException('Print job not found.');
        }

        if ((int)$current['org_id'] !== (int)$source['org_id']
            || (int)($current['provider_auto_assigned'] ?? 0) !== 1
            || strtolower((string)($current['status'] ?? '')) !== 'queued') {
            throw new ServiceTrackerConflictException('This print request changed or was already accepted. Refresh the queue and try again.');
        }
        if (stHasUnpaidPrintingBalance($pdo, (int)$current['user_id'], $orgId)) {
            throw new ServiceTrackerValidationException('This student has an unpaid printing balance with your organization and cannot submit another request here.');
        }

        $queueOrder = stGetNextQueueOrder($pdo, $orgId);
        $update = $pdo->prepare(
            "UPDATE print_jobs
             SET org_id = :org_id,
                 provider_auto_assigned = 0,
                 provider_accepted_at = NOW(),
                 queue_order = :queue_order,
                 last_updated_by_user_id = :updated_by
             WHERE print_job_id = :print_job_id
               AND COALESCE(provider_auto_assigned, 0) = 1
               AND status = 'queued'"
        );
        $update->execute([
            ':org_id' => $orgId,
            ':queue_order' => $queueOrder,
            ':updated_by' => $updatedByUserId > 0 ? $updatedByUserId : null,
            ':print_job_id' => $printJobId,
        ]);

        if ($update->rowCount() === 0) {
            throw new ServiceTrackerConflictException('This print request changed or was already accepted. Refresh the queue and try again.');
        }

        stNormalizeQueuedOrders($pdo, (int)$source['org_id']);
        if ((int)$source['org_id'] !== $orgId) {
            stNormalizeQueuedOrders($pdo, $orgId);
        }
        $result = stFetchPrintJob($pdo, $printJobId);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stUpdatePrintJobStatus(
    PDO $pdo,
    int $orgId,
    int $printJobId,
    string $status,
    int $updatedByUserId,
    array $paymentData = []
): array
{
    stRequirePrintingTransactionOwner($pdo);
    stEnsureSchema($pdo);
    $status = strtolower(trim($status));
    $allowed = ['queued', 'processing', 'ready_to_claim', 'claimed', 'cancelled'];
    if (!in_array($status, $allowed, true)) {
        throw new ServiceTrackerValidationException('Invalid print job status.');
    }

    stBeginPrintingTransaction($pdo);
    try {
        stLockPrintingQueues($pdo, [$orgId]);
        $lock = $pdo->prepare(
            "SELECT *
             FROM print_jobs
             WHERE print_job_id = :print_job_id
             FOR UPDATE"
        );
        $lock->execute([':print_job_id' => $printJobId]);
        $current = $lock->fetch();
        if (!$current) {
            throw new ServiceTrackerValidationException('Print job not found.');
        }
        if ((int)$current['org_id'] !== $orgId) {
            throw new ServiceTrackerAuthorizationException('You are not allowed to update this print job.');
        }

        if ($status === 'cancelled') {
            $expectedVersion = $paymentData['expected_version'] ?? null;
            if (!is_string($expectedVersion) || !preg_match('/^[a-f0-9]{64}$/D', $expectedVersion)
                || !hash_equals(stPrintingJobStateVersion($current), $expectedVersion)) {
                throw new ServiceTrackerConflictException('This print job changed or needs to be refreshed. Review the updated job before cancelling it.');
            }
        }

        $currentStatus = strtolower((string)$current['status']);
        $allowedTransitions = [
            'queued' => ['processing', 'cancelled'],
            'processing' => ['ready_to_claim', 'cancelled'],
            'ready_to_claim' => ['claimed', 'cancelled'],
        ];
        if (!in_array($status, $allowedTransitions[$currentStatus] ?? [], true)) {
            throw new ServiceTrackerValidationException('This print job changed status. Refresh the queue and try again.');
        }

        $fields = [
            'status = :status',
            'last_updated_by_user_id = :updated_by',
        ];
        $params = [
            ':status' => $status,
            ':updated_by' => $updatedByUserId > 0 ? $updatedByUserId : null,
            ':print_job_id' => $printJobId,
        ];

        if ($status === 'processing') {
            $fields[] = 'processing_started_at = NOW()';
        } elseif ($status === 'ready_to_claim') {
            $fields[] = 'ready_at = NOW()';
        } elseif ($status === 'claimed') {
            if (!isset($paymentData['total_cost']) || !is_numeric($paymentData['total_cost'])) {
                throw new ServiceTrackerValidationException('Enter the final printing price before claiming this job.');
            }
            $totalCost = round((float)$paymentData['total_cost'], 2);
            if ($totalCost <= 0 || $totalCost > 99999999.99) {
                throw new ServiceTrackerValidationException('Printing price must be greater than P0.00 and within the supported amount.');
            }
            $paymentStatus = strtolower(trim((string)($paymentData['payment_status'] ?? 'unpaid')));
            if (!in_array($paymentStatus, ['unpaid', 'paid'], true)) {
                throw new ServiceTrackerValidationException('Choose whether the printing payment is paid or unpaid.');
            }

            $fields[] = 'claimed_at = NOW()';
            $fields[] = 'total_cost = :total_cost';
            $fields[] = 'payment_status = :payment_status';
            $params[':total_cost'] = $totalCost;
            $params[':payment_status'] = $paymentStatus;
            if ($paymentStatus === 'paid') {
                $paidByUserId = stRequireActiveOfficerIdentifier(
                    $pdo,
                    $orgId,
                    (string)($paymentData['officer_identifier'] ?? '')
                );
                $fields[] = 'paid_at = NOW()';
                $fields[] = 'paid_by_user_id = :paid_by_user_id';
                $params[':paid_by_user_id'] = $paidByUserId;
            } else {
                $fields[] = 'paid_at = NULL';
                $fields[] = 'paid_by_user_id = NULL';
            }
        } elseif ($status === 'cancelled') {
            $fields[] = "payment_status = 'waived'";
            $fields[] = 'paid_at = NULL';
            $fields[] = 'paid_by_user_id = NULL';
        }

        $stmt = $pdo->prepare(
            "UPDATE print_jobs
             SET " . implode(', ', $fields) . "
             WHERE print_job_id = :print_job_id"
        );
        $stmt->execute($params);

        if ($currentStatus === 'queued' || $status === 'queued') {
            stNormalizeQueuedOrders($pdo, $orgId);
        }

        $result = stFetchPrintJob($pdo, $printJobId);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stCancelStudentPrintJob(PDO $pdo, int $userId, int $printJobId): array
{
    stRequirePrintingTransactionOwner($pdo);
    stEnsureSchema($pdo);
    if ($userId <= 0) {
        throw new ServiceTrackerAuthorizationException('Invalid student session.');
    }

    $current = stFetchPrintJob($pdo, $printJobId);
    if ((int)$current['user_id'] !== $userId) {
        throw new ServiceTrackerAuthorizationException('You are not allowed to cancel this print job.');
    }

    if (strtolower((string)$current['status']) !== 'queued') {
        throw new ServiceTrackerValidationException('Only queued print jobs can be cancelled.');
    }

    stBeginPrintingTransaction($pdo);
    try {
        stLockPrintingQueues($pdo, [(int)$current['org_id']]);
        $stmt = $pdo->prepare(
            "UPDATE print_jobs
             SET status = 'cancelled',
                 payment_status = 'waived',
                 paid_at = NULL,
                 paid_by_user_id = NULL,
                 last_updated_by_user_id = :updated_by
             WHERE print_job_id = :print_job_id
               AND user_id = :user_id
               AND org_id = :org_id
               AND status = 'queued'"
        );
        $stmt->execute([
            ':updated_by' => $userId,
            ':print_job_id' => $printJobId,
            ':user_id' => $userId,
            ':org_id' => (int)$current['org_id'],
        ]);
        if ($stmt->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('This print job changed. Refresh the queue and try again.');
        }

        stNormalizeQueuedOrders($pdo, (int)$current['org_id']);
        $result = stFetchPrintJob($pdo, $printJobId);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stReorderPrintJob(PDO $pdo, int $orgId, int $printJobId, int $newQueueOrder): array
{
    stRequirePrintingTransactionOwner($pdo);
    stEnsureSchema($pdo);
    if ($newQueueOrder <= 0) {
        throw new ServiceTrackerValidationException('Queue position must be greater than zero.');
    }

    stBeginPrintingTransaction($pdo);
    try {
        stLockPrintingQueues($pdo, [$orgId]);
        $stmt = $pdo->prepare(
            "SELECT print_job_id, queue_order, status
             FROM print_jobs
             WHERE org_id = :org_id
               AND status = 'queued'
             ORDER BY queue_order ASC, submitted_at ASC, print_job_id ASC
             FOR UPDATE"
        );
        $stmt->execute([':org_id' => $orgId]);
        $jobs = $stmt->fetchAll();

        if (!$jobs) {
            throw new ServiceTrackerValidationException('No queued print jobs found.');
        }

        $jobIds = array_map(static fn(array $row): int => (int)$row['print_job_id'], $jobs);
        if (!in_array($printJobId, $jobIds, true)) {
            throw new ServiceTrackerValidationException('Only queued print jobs can be reordered.');
        }

        $orderedIds = array_values(array_filter($jobIds, static fn(int $id): bool => $id !== $printJobId));
        $targetIndex = min(max($newQueueOrder, 1), count($orderedIds) + 1) - 1;
        array_splice($orderedIds, $targetIndex, 0, [$printJobId]);

        stWriteQueuedOrders($pdo, $orgId, $orderedIds);
        $result = stFetchPrintJob($pdo, $printJobId);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stGetStudentServicesOverview(PDO $pdo, int $userId = 0): array
{
    stEnsureSchema($pdo);
    $services = stListServiceCatalog($pdo);
    $modules = [];
    foreach ($services as $service) {
        $serviceKey = (string)($service['service_key'] ?? '');
        $providers = stListAuthorizedOrganizations($pdo, $serviceKey);
        $enabled = count($providers) > 0;

        $modules[] = [
            'service_key' => $serviceKey,
            'service_name' => $service['service_name'],
            'description' => $service['description'],
            'enabled' => $enabled,
            'provider_count' => count($providers),
        ];
    }

    $printingProviders = stListAuthorizedOrganizations($pdo, 'printing');
    foreach ($printingProviders as &$provider) {
        $hasBalance = $userId > 0 && stHasUnpaidPrintingBalance($pdo, $userId, (int)$provider['org_id']);
        $provider['has_unpaid_printing_balance'] = $hasBalance;
        $provider['printing_request_allowed'] = !$hasBalance;
    }
    unset($provider);

    return [
        'modules' => $modules,
        'printing_providers' => $printingProviders,
    ];
}

function stMarkPrintJobPaid(PDO $pdo, int $orgId, int $printJobId, string $officerIdentifier): array
{
    stEnsureSchema($pdo);
    if ($printJobId <= 0) {
        throw new ServiceTrackerValidationException('A valid print job is required.');
    }

    $paidByUserId = stRequireActiveOfficerIdentifier($pdo, $orgId, $officerIdentifier);
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare(
            "SELECT org_id, status, payment_status, total_cost
             FROM print_jobs
             WHERE print_job_id = :print_job_id
             FOR UPDATE"
        );
        $lock->execute([':print_job_id' => $printJobId]);
        $current = $lock->fetch();
        if (!$current) {
            throw new ServiceTrackerValidationException('Print job not found.');
        }
        if ((int)$current['org_id'] !== $orgId) {
            throw new ServiceTrackerAuthorizationException('You are not allowed to update this print payment.');
        }
        if (strtolower((string)$current['status']) !== 'claimed'
            || strtolower((string)$current['payment_status']) !== 'unpaid'
            || (float)$current['total_cost'] <= 0) {
            throw new ServiceTrackerValidationException('This print job is not eligible to be marked paid.');
        }

        $update = $pdo->prepare(
            "UPDATE print_jobs
             SET payment_status = 'paid',
                 paid_at = NOW(),
                 paid_by_user_id = :paid_by_user_id,
                 last_updated_by_user_id = :updated_by
             WHERE print_job_id = :print_job_id
               AND org_id = :org_id
               AND status = 'claimed'
               AND payment_status = 'unpaid'"
        );
        $update->execute([
            ':paid_by_user_id' => $paidByUserId,
            ':updated_by' => $paidByUserId,
            ':print_job_id' => $printJobId,
            ':org_id' => $orgId,
        ]);
        if ($update->rowCount() !== 1) {
            throw new ServiceTrackerValidationException('This print payment was already updated. Refresh the history and try again.');
        }

        $pdo->commit();
        return stFetchPrintJob($pdo, $printJobId);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stGetLockerPeriodOptions(): array
{
    return [
        'monthly' => ['label' => 'Monthly', 'months' => 1, 'rate_column' => 'locker_monthly_rate'],
        'semester' => ['label' => 'Per Semester', 'months' => 5, 'rate_column' => 'locker_semester_rate'],
        'school_year' => ['label' => 'Whole School Year', 'months' => 10, 'rate_column' => 'locker_school_year_rate'],
    ];
}

function stSyncLockerStatuses(PDO $pdo, int $orgId): void
{
    stEnsureLockerInventory($pdo, $orgId);
    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) {
        $pdo->beginTransaction();
    }

    try {
        $updateOverdue = $pdo->prepare(
            "UPDATE rentals
             SET status = :overdue_status
             WHERE org_id = :org_id
               AND service_kind = :service_kind
               AND status = :active_status
               AND expected_return_time < NOW()"
        );
        $updateOverdue->execute([
            ':overdue_status' => ST_LOCKER_OVERDUE,
            ':org_id' => $orgId,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
            ':active_status' => ST_LOCKER_ACTIVE,
        ]);

        // Locker inventory rows are the mutex for assignment changes. Lock all of
        // them before deriving statuses so a concurrent request cannot be
        // overwritten by a stale status snapshot.
        $itemsStmt = $pdo->prepare(
            "SELECT item_id
             FROM inventory_items
             WHERE org_id = :org_id
               AND category_id = :category_id
             ORDER BY item_id
             FOR UPDATE"
        );
        $itemsStmt->execute([
            ':org_id' => $orgId,
            ':category_id' => $categoryId,
        ]);
        $itemIds = array_map(static fn(array $row): int => (int)$row['item_id'], $itemsStmt->fetchAll());

        if ($itemIds) {
            $activeStmt = $pdo->prepare(
                "SELECT ri.item_id, r.status
                 FROM rentals r
                 JOIN rental_items ri ON ri.rental_id = r.rental_id
                 WHERE r.org_id = :org_id
                   AND r.service_kind = :service_kind
                   AND r.status IN (:pending_status, :active_status, :overdue_status)"
            );
            $activeStmt->execute([
                ':org_id' => $orgId,
                ':service_kind' => ST_LOCKER_SERVICE_KIND,
                ':pending_status' => ST_LOCKER_PENDING,
                ':active_status' => ST_LOCKER_ACTIVE,
                ':overdue_status' => ST_LOCKER_OVERDUE,
            ]);

            $statusMap = [];
            foreach ($activeStmt->fetchAll() as $row) {
                $itemId = (int)$row['item_id'];
                $status = (string)$row['status'];
                if (!isset($statusMap[$itemId])) {
                    $statusMap[$itemId] = $status;
                }
            }

            $updateItem = $pdo->prepare(
                "UPDATE inventory_items
                 SET status = :status
                 WHERE item_id = :item_id"
            );
            foreach ($itemIds as $itemId) {
                $lockerStatus = $statusMap[$itemId] ?? 'available';
                if ($lockerStatus === ST_LOCKER_PENDING) {
                    $itemStatus = ST_LOCKER_PENDING;
                } elseif ($lockerStatus === ST_LOCKER_OVERDUE) {
                    $itemStatus = ST_LOCKER_OVERDUE;
                } elseif ($lockerStatus === ST_LOCKER_ACTIVE) {
                    $itemStatus = 'locker_occupied';
                } else {
                    $itemStatus = 'available';
                }
                $updateItem->execute([
                    ':status' => $itemStatus,
                    ':item_id' => $itemId,
                ]);
            }
        }

        if ($ownsTransaction) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stGetActiveLockerRentalByItem(PDO $pdo, int $itemId): ?array
{
    $hasStudentProfilesTable = false;
    try {
        $tableStmt = $pdo->query("SHOW TABLES LIKE 'student_profiles'");
        $hasStudentProfilesTable = (bool)$tableStmt->fetchColumn();
    } catch (Throwable $e) {
        $hasStudentProfilesTable = false;
    }

    $sectionSelect = 'NULL AS section';
    $sectionJoin = '';
    if ($hasStudentProfilesTable) {
        $sectionSelect = 'sp.section';
        $sectionJoin = 'LEFT JOIN student_profiles sp ON sp.user_id = u.user_id';
    }

    $stmt = $pdo->prepare(
        "SELECT r.*,
                ri.item_id,
                ri.unit_rate,
                ri.item_cost,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
                u.student_number,
                {$sectionSelect}
         FROM rentals r
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         JOIN users u ON u.user_id = r.renter_user_id
         {$sectionJoin}
         WHERE ri.item_id = :item_id
           AND r.service_kind = :service_kind
           AND r.status IN (:pending_status, :active_status, :overdue_status)
         ORDER BY
           CASE r.status
             WHEN :overdue_order_status THEN 0
             WHEN :active_order_status THEN 1
             WHEN :pending_order_status THEN 2
             ELSE 3
           END,
           r.updated_at DESC,
           r.rental_id DESC
         LIMIT 1"
    );
    $stmt->execute([
        ':item_id' => $itemId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ':pending_status' => ST_LOCKER_PENDING,
        ':active_status' => ST_LOCKER_ACTIVE,
        ':overdue_status' => ST_LOCKER_OVERDUE,
        ':overdue_order_status' => ST_LOCKER_OVERDUE,
        ':active_order_status' => ST_LOCKER_ACTIVE,
        ':pending_order_status' => ST_LOCKER_PENDING,
    ]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function stGetActiveLockerRentalByStudent(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare(
        "SELECT r.*,
                ri.item_id,
                ri.unit_rate,
                ri.item_cost,
                i.item_name AS locker_code,
                o.org_name,
                o.org_code,
                i.locker_monthly_rate,
                i.locker_semester_rate,
                i.locker_school_year_rate
         FROM rentals r
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         JOIN inventory_items i ON i.item_id = ri.item_id
         JOIN organizations o ON o.org_id = r.org_id
         WHERE r.renter_user_id = :user_id
           AND r.service_kind = :service_kind
           AND r.status IN (:pending_status, :active_status, :overdue_status)
         ORDER BY r.updated_at DESC, r.rental_id DESC
         LIMIT 1"
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ':pending_status' => ST_LOCKER_PENDING,
        ':active_status' => ST_LOCKER_ACTIVE,
        ':overdue_status' => ST_LOCKER_OVERDUE,
    ]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function stGetLatestLockerRentalByStudent(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare(
        "SELECT r.*,
                ri.item_id,
                ri.unit_rate,
                ri.item_cost,
                i.item_name AS locker_code,
                o.org_name,
                o.org_code,
                i.locker_monthly_rate,
                i.locker_semester_rate,
                i.locker_school_year_rate
         FROM rentals r
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         JOIN inventory_items i ON i.item_id = ri.item_id
         JOIN organizations o ON o.org_id = r.org_id
         WHERE r.renter_user_id = :user_id
           AND r.service_kind = :service_kind
         ORDER BY r.updated_at DESC, r.rental_id DESC
         LIMIT 1"
    );
    $stmt->execute([
        ':user_id' => $userId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
    ]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function stIsReleasedLockerNoticeVisible(array $rental): bool
{
    if ((string)($rental['status'] ?? '') !== ST_LOCKER_RELEASED) {
        return false;
    }

    $message = trim((string)($rental['locker_notice_message'] ?? ''));
    if ($message === '') {
        return false;
    }

    $anchor = trim((string)($rental['locker_notice_sent_at'] ?? ''));
    if ($anchor === '') {
        $anchor = trim((string)($rental['updated_at'] ?? ''));
    }
    if ($anchor === '') {
        return false;
    }

    $sentAt = strtotime($anchor);
    if (!$sentAt) {
        return false;
    }

    $expiresAt = strtotime('+' . ST_LOCKER_RELEASE_NOTICE_VISIBLE_DAYS . ' days', $sentAt);
    return $expiresAt !== false && time() <= $expiresAt;
}

function stMapLockerNoticePayload(array $rental): array
{
    return [
        'upcoming_notice_sent_at' => (string)($rental['locker_upcoming_notice_sent_at'] ?? ''),
        'upcoming_notice_message' => (string)($rental['locker_upcoming_notice_message'] ?? ''),
        'overdue_notice_sent_at' => (string)($rental['locker_notice_sent_at'] ?? ''),
        'overdue_notice_message' => (string)($rental['locker_notice_message'] ?? ''),
        // Compatibility fields while the UI transitions to the explicit names.
        'locker_notice_sent_at' => (string)($rental['locker_notice_sent_at'] ?? ''),
        'locker_notice_message' => (string)($rental['locker_notice_message'] ?? ''),
    ];
}

function stIsLockerUpcomingNoticeAllowed(array $rental): bool
{
    if ((string)($rental['status'] ?? '') !== ST_LOCKER_ACTIVE) {
        return false;
    }

    $expectedReturnRaw = trim((string)($rental['expected_return_time'] ?? ''));
    if ($expectedReturnRaw === '') {
        return false;
    }

    try {
        // Locker dates are stored as Manila wall-clock values without a UTC
        // offset, so they must not be interpreted using the PHP host timezone.
        $timezone = new DateTimeZone('Asia/Manila');
        $expectedReturn = new DateTimeImmutable($expectedReturnRaw, $timezone);
        $now = new DateTimeImmutable('now', $timezone);
        $windowEnd = $now->modify('+' . ST_LOCKER_UPCOMING_NOTICE_WINDOW_DAYS . ' days');
    } catch (Throwable $e) {
        return false;
    }

    return $expectedReturn >= $now && $expectedReturn <= $windowEnd;
}

function stFormatLockerStateFromRental(?array $rental): string
{
    if (!$rental) {
        return 'available';
    }
    $status = strtolower((string)($rental['status'] ?? ''));
    if ($status === ST_LOCKER_PENDING) {
        return 'pending';
    }
    if ($status === ST_LOCKER_OVERDUE) {
        return 'overdue';
    }
    if ($status === ST_LOCKER_ACTIVE) {
        return 'occupied';
    }
    return 'available';
}

function stInferLockerPeriodQuantity(array $rental, array $item): int
{
    $periodType = strtolower((string)($rental['locker_period_type'] ?? ''));
    if ($periodType === 'school_year') {
        return 1;
    }

    $monthsPerPeriod = $periodType === 'semester' ? 5 : 1;
    $maximumQuantity = $periodType === 'semester' ? 8 : 24;
    $savedQuantity = (int)($rental['locker_period_quantity'] ?? 0);
    if ($savedQuantity >= 1 && $savedQuantity <= $maximumQuantity) {
        return $savedQuantity;
    }

    $dateQuantity = null;
    try {
        $start = new DateTimeImmutable((string)($rental['rent_time'] ?? ''));
        $end = new DateTimeImmutable((string)($rental['expected_return_time'] ?? ''));
        if ($end > $start) {
            $expectedEndDate = $end->format('Y-m-d');

            // Replay the same date-addition rule used by
            // stComputeLockerDatesAndPrice(). Calendar-month subtraction is
            // not its inverse around month-end dates (Jan 31 + 1 month is
            // Mar 3), and can otherwise turn one requested period into two.
            for ($quantity = 1; $quantity <= $maximumQuantity; $quantity++) {
                $candidateEnd = $start->modify('+' . ($monthsPerPeriod * $quantity) . ' month');
                if ($candidateEnd->format('Y-m-d') === $expectedEndDate) {
                    $dateQuantity = $quantity;
                    break;
                }
            }

            // Semester requests may have a custom end date, so retain a
            // best-effort fallback when no generated boundary matches.
            if ($dateQuantity === null) {
                $calendarMonths = max(1, ((int)$end->format('Y') - (int)$start->format('Y')) * 12
                    + ((int)$end->format('n') - (int)$start->format('n')));
                $dateQuantity = $periodType === 'semester'
                    ? max(1, (int)round($calendarMonths / $monthsPerPeriod))
                    : $calendarMonths;
            }
        }
    } catch (Throwable $e) {
        $dateQuantity = null;
    }

    $rateColumn = $periodType === 'semester' ? 'locker_semester_rate' : 'locker_monthly_rate';
    $storedRate = (float)($rental['unit_rate'] ?? 0);
    $total = (float)($rental['total_cost'] ?? 0);
    $configuredRate = (float)($item[$rateColumn] ?? 0);
    $configuredQuantity = null;
    if ($configuredRate > 0 && $total > 0) {
        $roundedQuantity = (int)round($total / $configuredRate);
        if ($roundedQuantity >= 1
            && $roundedQuantity <= $maximumQuantity
            && abs($total - ($configuredRate * $roundedQuantity)) < 0.01) {
            $configuredQuantity = $roundedQuantity;
        }
    }

    // Older locker rentals stored the full calculated price in both unit_rate
    // and total_cost. Identify that snapshot independently of the date-derived
    // quantity. Prefer the immutable saved dates because current inventory
    // rates may have changed since the request was made. The configured rate is
    // only a last resort when no usable date interval remains.
    $isLegacyFullTotalSnapshot = $storedRate > 0
        && $total > 0
        && abs($storedRate - $total) < 0.01;
    if ($isLegacyFullTotalSnapshot) {
        if ($dateQuantity !== null) {
            return $dateQuantity;
        }
        if ($configuredQuantity !== null) {
            return $configuredQuantity;
        }
    }

    if ($storedRate > 0 && $total >= 0) {
        return max(1, (int)round($total / $storedRate));
    }

    if ($configuredQuantity !== null) {
        return $configuredQuantity;
    }

    return $dateQuantity ?? 1;
}

function stLockerPeriodQuantityRequiresConfirmation(array $rental): bool
{
    if (strtolower((string)($rental['locker_period_type'] ?? '')) !== 'semester') {
        return false;
    }

    $savedQuantity = (int)($rental['locker_period_quantity'] ?? 0);
    if ($savedQuantity >= 1 && $savedQuantity <= 8) {
        return false;
    }

    $storedRate = (float)($rental['unit_rate'] ?? 0);
    $total = (float)($rental['total_cost'] ?? 0);
    // When both values are the same, legacy storage cannot distinguish a
    // one-semester rate from a multi-semester full total. This remains
    // ambiguous even for zero-priced or standard-boundary rentals.
    return abs($storedRate - $total) < 0.01;
}

function stListLockerBoard(PDO $pdo, int $orgId): array
{
    if (!stIsSscOrg($pdo, $orgId)) {
        return ['enabled' => false, 'lockers' => []];
    }

    stSyncLockerStatuses($pdo, $orgId);
    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $stmt = $pdo->prepare(
        "SELECT item_id, item_name, barcode, status, locker_monthly_rate, locker_semester_rate, locker_school_year_rate
         FROM inventory_items
         WHERE org_id = :org_id
           AND category_id = :category_id
         ORDER BY item_name ASC"
    );
    $stmt->execute([
        ':org_id' => $orgId,
        ':category_id' => $categoryId,
    ]);

    $lockers = [];
    foreach ($stmt->fetchAll() as $row) {
        $currentRental = stGetActiveLockerRentalByItem($pdo, (int)$row['item_id']);
        $state = stFormatLockerStateFromRental($currentRental);
        $lockers[] = [
            'item_id' => (int)$row['item_id'],
            'locker_code' => (string)$row['item_name'],
            'column_key' => substr((string)$row['item_name'], 0, 1),
            'slot_label' => substr((string)$row['item_name'], 1),
            'state' => $state,
            'locker_monthly_rate' => (float)($row['locker_monthly_rate'] ?? 0),
            'locker_semester_rate' => (float)($row['locker_semester_rate'] ?? 0),
            'locker_school_year_rate' => (float)($row['locker_school_year_rate'] ?? 0),
            'current_request' => $currentRental ? [
                'rental_id' => (int)$currentRental['rental_id'],
                'student_name' => trim((string)($currentRental['student_name'] ?? '')),
                'student_number' => (string)($currentRental['student_number'] ?? ''),
                'section' => (string)($currentRental['section'] ?? ''),
                'status' => (string)$currentRental['status'],
                'payment_status' => strtolower((string)($currentRental['payment_status'] ?? 'unpaid')) === 'paid' ? 'paid' : 'unpaid',
                'rent_time' => (string)($currentRental['rent_time'] ?? ''),
                'expected_return_time' => (string)($currentRental['expected_return_time'] ?? ''),
                'total_cost' => (float)($currentRental['total_cost'] ?? 0),
                'locker_period_type' => (string)($currentRental['locker_period_type'] ?? ''),
                'locker_period_quantity' => stInferLockerPeriodQuantity($currentRental, $row),
                'locker_period_quantity_requires_confirmation' => stLockerPeriodQuantityRequiresConfirmation($currentRental),
                'can_send_upcoming_notice' => stIsLockerUpcomingNoticeAllowed($currentRental),
            ] + stMapLockerNoticePayload($currentRental) : null,
        ];
    }

    return ['enabled' => true, 'lockers' => $lockers];
}

function stListStudentLockers(PDO $pdo, int $userId): array
{
    $sscOrg = stResolveSscOrg($pdo);
    if (!$sscOrg || !stIsSscOrg($pdo, (int)$sscOrg['org_id'])) {
        return ['enabled' => false, 'lockers' => [], 'current_locker' => null];
    }

    $orgId = (int)$sscOrg['org_id'];
    $board = stListLockerBoard($pdo, $orgId);
    $activeLocker = stGetActiveLockerRentalByStudent($pdo, $userId);
    $currentLocker = $activeLocker;
    if (!$activeLocker) {
        $latestLocker = stGetLatestLockerRentalByStudent($pdo, $userId);
        if ($latestLocker && stIsReleasedLockerNoticeVisible($latestLocker)) {
            $currentLocker = $latestLocker;
        }
    }
    // A recently released locker remains in current_locker only so its pull-out
    // notice stays visible. It must not block a new request or be marked as the
    // student's current locker on the availability board.
    $activeLockerCode = $activeLocker ? (string)$activeLocker['locker_code'] : '';

    $lockers = array_map(static function (array $locker) use ($activeLockerCode): array {
        return [
            'item_id' => (int)$locker['item_id'],
            'locker_code' => (string)$locker['locker_code'],
            'column_key' => (string)$locker['column_key'],
            'slot_label' => (string)$locker['slot_label'],
            'state' => (string)$locker['state'],
            'locker_monthly_rate' => (float)($locker['locker_monthly_rate'] ?? 0),
            'locker_semester_rate' => (float)($locker['locker_semester_rate'] ?? 0),
            'locker_school_year_rate' => (float)($locker['locker_school_year_rate'] ?? 0),
            'request_allowed' => $locker['state'] === 'available' && $activeLockerCode === '',
        ];
    }, $board['lockers']);

    return [
        'enabled' => true,
        'org_id' => $orgId,
        'org_name' => (string)$sscOrg['org_name'],
        'org_code' => (string)$sscOrg['org_code'],
        'lockers' => $lockers,
        'current_locker' => $currentLocker ? [
            'rental_id' => (int)$currentLocker['rental_id'],
            'locker_code' => (string)$currentLocker['locker_code'],
            'status' => (string)$currentLocker['status'],
            'payment_status' => strtolower((string)($currentLocker['payment_status'] ?? 'unpaid')) === 'paid' ? 'paid' : 'unpaid',
            'rent_time' => (string)$currentLocker['rent_time'],
            'expected_return_time' => (string)$currentLocker['expected_return_time'],
            'total_cost' => (float)($currentLocker['total_cost'] ?? 0),
            'locker_period_type' => (string)($currentLocker['locker_period_type'] ?? ''),
            'locker_period_quantity' => stInferLockerPeriodQuantity($currentLocker, $currentLocker),
            'org_name' => (string)($currentLocker['org_name'] ?? ''),
            'org_code' => (string)($currentLocker['org_code'] ?? ''),
        ] + stMapLockerNoticePayload($currentLocker) : null,
    ];
}

function stRequestLocker(PDO $pdo, int $userId, int $itemId, array $data = []): array
{
    $sscOrg = stResolveSscOrg($pdo);
    if (!$sscOrg) {
        throw new ServiceTrackerValidationException('Locker service is not available right now.');
    }
    $orgId = (int)$sscOrg['org_id'];
    if (!stIsSscOrg($pdo, $orgId)) {
        throw new ServiceTrackerAuthorizationException('Locker service is not enabled.');
    }

    stSyncLockerStatuses($pdo, $orgId);
    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $pdo->beginTransaction();
    try {
        // The student row prevents the same student from claiming different
        // lockers through simultaneous requests.
        $studentStmt = $pdo->prepare(
            "SELECT user_id
             FROM users
             WHERE user_id = :user_id
               AND account_type = 'student'
               AND is_active = 1
             LIMIT 1
             FOR UPDATE"
        );
        $studentStmt->execute([':user_id' => $userId]);
        if (!$studentStmt->fetch()) {
            throw new ServiceTrackerValidationException('Student account not found or inactive.');
        }

        // The inventory row is the mutex for this physical locker. Every
        // locker creation path locks the student first and the item second.
        $itemStmt = $pdo->prepare(
            "SELECT i.item_id, i.item_name, i.org_id, i.status,
                    i.locker_monthly_rate, i.locker_semester_rate, i.locker_school_year_rate
             FROM inventory_items i
             WHERE i.item_id = :item_id
               AND i.org_id = :org_id
               AND i.category_id = :category_id
             LIMIT 1
             FOR UPDATE"
        );
        $itemStmt->execute([
            ':item_id' => $itemId,
            ':org_id' => $orgId,
            ':category_id' => $categoryId,
        ]);
        $item = $itemStmt->fetch();
        if (!$item) {
            throw new ServiceTrackerValidationException('Selected locker was not found.');
        }

        if (stGetActiveLockerRentalByStudent($pdo, $userId)) {
            throw new ServiceTrackerConflictException('You already have a pending or active locker assignment.');
        }
        if ((string)$item['status'] !== 'available' || stGetActiveLockerRentalByItem($pdo, $itemId)) {
            throw new ServiceTrackerConflictException('That locker was just taken by another user. Refresh and select another locker.');
        }

        $computed = stComputeLockerDatesAndPrice($item, $data);
        $requestedStart = new DateTimeImmutable($computed['start_at'], new DateTimeZone('Asia/Manila'));
        $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
        if ($requestedStart < $today) {
            throw new ServiceTrackerValidationException('Locker requests cannot start before today.');
        }

        $rentalId = stInsertLockerRental($pdo, $itemId, [
            ':org_id' => $orgId,
            ':user_id' => $userId,
            ':processed_by_user_id' => $userId,
            ':rent_time' => $computed['start_at'],
            ':expected_return_time' => $computed['end_at'],
            ':total_cost' => $computed['price'],
            ':status' => ST_LOCKER_PENDING,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
            ':locker_period_type' => $computed['period_type'],
            ':locker_period_quantity' => $computed['period_quantity'],
        ]);

        $insertRentalItem = $pdo->prepare(
            "INSERT INTO rental_items
                (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
             VALUES
                (:rental_id, :item_id, 1, :unit_rate, :item_cost, NULL, NULL)"
        );
        $insertRentalItem->execute([
            ':rental_id' => $rentalId,
            ':item_id' => $itemId,
            ':unit_rate' => $computed['unit_rate'],
            ':item_cost' => $computed['price'],
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = :status
             WHERE item_id = :item_id
               AND org_id = :org_id
               AND status = 'available'"
        );
        $updateItem->execute([
            ':status' => ST_LOCKER_PENDING,
            ':item_id' => $itemId,
            ':org_id' => $orgId,
        ]);
        if ($updateItem->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('That locker was just taken by another user. Refresh and select another locker.');
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    notificationEmailDispatchLockerEventBestEffort($pdo, $rentalId, 'pending');
    return stListStudentLockers($pdo, $userId);
}

function stComputeLockerDatesAndPrice(array $item, array $data): array
{
    $periodType = strtolower(trim((string)($data['period_type'] ?? 'monthly')));
    $periods = stGetLockerPeriodOptions();
    if (!isset($periods[$periodType])) {
        throw new ServiceTrackerValidationException('Invalid locker period selected.');
    }

    $startDateRaw = trim((string)($data['start_date'] ?? ''));
    if ($startDateRaw === '') {
        throw new ServiceTrackerValidationException('A locker start date is required.');
    }
    $tz = new DateTimeZone('Asia/Manila');
    $startDate = DateTimeImmutable::createFromFormat('!Y-m-d', $startDateRaw, $tz);
    $startErrors = DateTimeImmutable::getLastErrors();
    if (!$startDate || ($startErrors !== false && ($startErrors['warning_count'] > 0 || $startErrors['error_count'] > 0)) || $startDate->format('Y-m-d') !== $startDateRaw) {
        throw new ServiceTrackerValidationException('A valid locker start date is required.');
    }

    $quantity = $periodType === 'school_year' ? 1 : (int)($data['period_quantity'] ?? 1);
    $maximumQuantity = $periodType === 'semester' ? 8 : 24;
    if ($quantity < 1 || $quantity > $maximumQuantity) {
        throw new ServiceTrackerValidationException(
            $periodType === 'semester'
                ? 'Locker semester quantity must be between 1 and 8.'
                : 'Locker period quantity must be between 1 and 24.'
        );
    }

    $months = (int)$periods[$periodType]['months'] * $quantity;
    $endDate = $startDate->modify('+' . $months . ' month');
    $customEndDateRaw = trim((string)($data['end_date'] ?? ''));
    if (in_array($periodType, ['semester', 'school_year'], true) && $customEndDateRaw !== '') {
        $customEndDate = DateTimeImmutable::createFromFormat('!Y-m-d', $customEndDateRaw, $tz);
        $endErrors = DateTimeImmutable::getLastErrors();
        if (!$customEndDate || ($endErrors !== false && ($endErrors['warning_count'] > 0 || $endErrors['error_count'] > 0)) || $customEndDate->format('Y-m-d') !== $customEndDateRaw) {
            throw new ServiceTrackerValidationException('A valid locker end date is required.');
        }
        if ($customEndDate <= $startDate) {
            throw new ServiceTrackerValidationException('Locker end date must be after the start date.');
        }
        $endDate = $customEndDate;
    }
    $endDate = $endDate->setTime(23, 59, 59);
    $rateColumn = (string)$periods[$periodType]['rate_column'];
    $unitRate = (float)($item[$rateColumn] ?? 0);
    $price = $unitRate * $quantity;

    if ($price < 0) {
        throw new ServiceTrackerValidationException('Locker price cannot be negative.');
    }

    return [
        'period_type' => $periodType,
        'period_quantity' => $quantity,
        'unit_rate' => round($unitRate, 2),
        'start_at' => $startDate->format('Y-m-d H:i:s'),
        'end_at' => $endDate->format('Y-m-d H:i:s'),
        'price' => round($price, 2),
    ];
}

function stAssignLockerManually(PDO $pdo, int $orgId, int $officerUserId, int $itemId, int $studentUserId, array $data): array
{
    stRequireLockerOfficerContext($pdo);
    stSyncLockerStatuses($pdo, $orgId);

    if ($itemId <= 0) {
        throw new ServiceTrackerValidationException('A locker selection is required.');
    }
    if ($studentUserId <= 0) {
        throw new ServiceTrackerValidationException('A student selection is required.');
    }

    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $pdo->beginTransaction();
    try {
        $studentStmt = $pdo->prepare(
            "SELECT user_id, student_number
             FROM users
             WHERE user_id = :user_id
               AND account_type = 'student'
               AND is_active = 1
             LIMIT 1
             FOR UPDATE"
        );
        $studentStmt->execute([':user_id' => $studentUserId]);
        $student = $studentStmt->fetch();
        if (!$student) {
            throw new ServiceTrackerValidationException('Selected student was not found.');
        }

        $itemStmt = $pdo->prepare(
            "SELECT i.item_id, i.item_name, i.status,
                    i.locker_monthly_rate, i.locker_semester_rate, i.locker_school_year_rate
             FROM inventory_items i
             WHERE i.item_id = :item_id
               AND i.org_id = :org_id
               AND i.category_id = :category_id
             LIMIT 1
             FOR UPDATE"
        );
        $itemStmt->execute([
            ':item_id' => $itemId,
            ':org_id' => $orgId,
            ':category_id' => $categoryId,
        ]);
        $item = $itemStmt->fetch();
        if (!$item) {
            throw new ServiceTrackerValidationException('Selected locker was not found.');
        }

        if (stGetActiveLockerRentalByStudent($pdo, $studentUserId)) {
            throw new ServiceTrackerConflictException('That student already has a pending or active locker assignment.');
        }
        if ((string)$item['status'] !== 'available' || stGetActiveLockerRentalByItem($pdo, $itemId)) {
            throw new ServiceTrackerConflictException('That locker was just taken by another user. Refresh and select another locker.');
        }

        $computed = stComputeLockerDatesAndPrice($item, $data);
        $rentalId = stInsertLockerRental($pdo, $itemId, [
            ':org_id' => $orgId,
            ':user_id' => $studentUserId,
            ':processed_by_user_id' => $officerUserId,
            ':rent_time' => $computed['start_at'],
            ':expected_return_time' => $computed['end_at'],
            ':total_cost' => $computed['price'],
            ':status' => ST_LOCKER_ACTIVE,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
            ':locker_period_type' => $computed['period_type'],
            ':locker_period_quantity' => $computed['period_quantity'],
        ]);

        $insertRentalItem = $pdo->prepare(
            "INSERT INTO rental_items
                (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
             VALUES
                (:rental_id, :item_id, 1, :unit_rate, :item_cost, NULL, NULL)"
        );
        $insertRentalItem->execute([
            ':rental_id' => $rentalId,
            ':item_id' => $itemId,
            ':unit_rate' => $computed['unit_rate'],
            ':item_cost' => $computed['price'],
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'locker_occupied'
             WHERE item_id = :item_id
               AND org_id = :org_id
               AND status = 'available'"
        );
        $updateItem->execute([
            ':item_id' => $itemId,
            ':org_id' => $orgId,
        ]);
        if ($updateItem->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('That locker was just taken by another user. Refresh and select another locker.');
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    stSyncLockerStatuses($pdo, $orgId);
    notificationEmailDispatchLockerEventBestEffort($pdo, $rentalId, 'assigned');
    return stListLockerBoard($pdo, $orgId);
}

function stApproveLockerRequest(PDO $pdo, int $orgId, int $officerUserId, int $rentalId, array $data): array
{
    stRequireLockerOfficerContext($pdo);
    stSyncLockerStatuses($pdo, $orgId);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT r.*, ri.item_id, ri.unit_rate, i.item_name,
                    i.locker_monthly_rate, i.locker_semester_rate, i.locker_school_year_rate
             FROM rentals r
             JOIN rental_items ri ON ri.rental_id = r.rental_id
             JOIN inventory_items i ON i.item_id = ri.item_id
             WHERE r.rental_id = :rental_id
               AND r.org_id = :org_id
               AND r.service_kind = :service_kind
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([
            ':rental_id' => $rentalId,
            ':org_id' => $orgId,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ]);
        $locker = $stmt->fetch();
        if (!$locker) {
            throw new ServiceTrackerValidationException('Locker request not found.');
        }
        if ((string)$locker['status'] !== ST_LOCKER_PENDING) {
            throw new ServiceTrackerConflictException('This locker request was already processed. Refresh the locker list.');
        }

        if (stLockerPeriodQuantityRequiresConfirmation($locker)
            && filter_var($data['legacy_period_quantity_confirmed'] ?? false, FILTER_VALIDATE_BOOLEAN) !== true) {
            throw new ServiceTrackerValidationException(
                'This legacy custom-semester request has no saved quantity. Verify the semester quantity and confirm it before approval.'
            );
        }

        $computed = stComputeLockerDatesAndPrice($locker, $data);
        $updateRental = $pdo->prepare(
            "UPDATE rentals
             SET processed_by_user_id = :processed_by_user_id,
                 rent_time = :rent_time,
                 expected_return_time = :expected_return_time,
                 total_cost = :total_cost,
                 status = :status,
                 locker_period_type = :locker_period_type,
                 locker_period_quantity = :locker_period_quantity,
                 locker_notice_sent_at = NULL,
                 locker_notice_message = NULL,
                 locker_notice_sent_by_user_id = NULL,
                 locker_upcoming_notice_sent_at = NULL,
                 locker_upcoming_notice_message = NULL,
                 locker_upcoming_notice_sent_by_user_id = NULL
             WHERE rental_id = :rental_id
               AND status = :expected_status"
        );
        $updateRental->execute([
            ':processed_by_user_id' => $officerUserId,
            ':rent_time' => $computed['start_at'],
            ':expected_return_time' => $computed['end_at'],
            ':total_cost' => $computed['price'],
            ':status' => ST_LOCKER_ACTIVE,
            ':locker_period_type' => $computed['period_type'],
            ':locker_period_quantity' => $computed['period_quantity'],
            ':rental_id' => $rentalId,
            ':expected_status' => ST_LOCKER_PENDING,
        ]);
        if ($updateRental->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('This locker request was already processed. Refresh the locker list.');
        }

        $updateRentalItem = $pdo->prepare(
            "UPDATE rental_items
             SET unit_rate = :unit_rate,
                 item_cost = :item_cost
             WHERE rental_id = :rental_id"
        );
        $updateRentalItem->execute([
            ':unit_rate' => $computed['unit_rate'],
            ':item_cost' => $computed['price'],
            ':rental_id' => $rentalId,
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'locker_occupied'
             WHERE item_id = :item_id
               AND org_id = :org_id"
        );
        $updateItem->execute([
            ':item_id' => (int)$locker['item_id'],
            ':org_id' => $orgId,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    stSyncLockerStatuses($pdo, $orgId);
    notificationEmailDispatchLockerEventBestEffort($pdo, $rentalId, 'approved');
    return stListLockerBoard($pdo, $orgId);
}

function stReleaseLocker(PDO $pdo, int $orgId, int $officerUserId, int $rentalId): array
{
    stRequireLockerOfficerContext($pdo);
    $releaseNotice = 'Locker has been pulled out. If you left any items inside the locker, you may claim them at the SSC office. This notice will remain visible for 2 weeks or until you rent another locker.';

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT r.rental_id, r.status, ri.item_id
             FROM rentals r
             JOIN rental_items ri ON ri.rental_id = r.rental_id
             JOIN inventory_items i ON i.item_id = ri.item_id
             WHERE r.rental_id = :rental_id
               AND r.org_id = :org_id
               AND r.service_kind = :service_kind
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([
            ':rental_id' => $rentalId,
            ':org_id' => $orgId,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ]);
        $locker = $stmt->fetch();
        if (!$locker || !in_array((string)$locker['status'], [ST_LOCKER_ACTIVE, ST_LOCKER_OVERDUE], true)) {
            throw new ServiceTrackerConflictException('This locker assignment is no longer active. Refresh the locker list.');
        }

        $updateRental = $pdo->prepare(
            "UPDATE rentals
             SET processed_by_user_id = :processed_by_user_id,
                 actual_return_time = NOW(),
                 status = :status,
                 locker_notice_sent_at = NOW(),
                 locker_notice_message = :locker_notice_message,
                 locker_notice_sent_by_user_id = :locker_notice_sent_by_user_id
             WHERE rental_id = :rental_id
               AND status IN (:active_status, :overdue_status)"
        );
        $updateRental->execute([
            ':processed_by_user_id' => $officerUserId,
            ':status' => ST_LOCKER_RELEASED,
            ':locker_notice_message' => $releaseNotice,
            ':locker_notice_sent_by_user_id' => $officerUserId,
            ':rental_id' => $rentalId,
            ':active_status' => ST_LOCKER_ACTIVE,
            ':overdue_status' => ST_LOCKER_OVERDUE,
        ]);
        if ($updateRental->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('This locker assignment was already updated. Refresh the locker list.');
        }

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'available'
             WHERE item_id = :item_id
               AND org_id = :org_id"
        );
        $updateItem->execute([
            ':item_id' => (int)$locker['item_id'],
            ':org_id' => $orgId,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    notificationEmailDispatchLockerEventBestEffort($pdo, $rentalId, 'released', $releaseNotice);
    return stListLockerBoard($pdo, $orgId);
}

function stRejectLockerRequest(PDO $pdo, int $orgId, int $officerUserId, int $rentalId): array
{
    stRequireLockerOfficerContext($pdo);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "SELECT r.rental_id, r.status, ri.item_id
             FROM rentals r
             JOIN rental_items ri ON ri.rental_id = r.rental_id
             JOIN inventory_items i ON i.item_id = ri.item_id
             WHERE r.rental_id = :rental_id
               AND r.org_id = :org_id
               AND r.service_kind = :service_kind
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([
            ':rental_id' => $rentalId,
            ':org_id' => $orgId,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ]);
        $locker = $stmt->fetch();
        if (!$locker || (string)$locker['status'] !== ST_LOCKER_PENDING) {
            throw new ServiceTrackerConflictException('This locker request was already processed. Refresh the locker list.');
        }

        $updateRental = $pdo->prepare(
            "UPDATE rentals
             SET processed_by_user_id = :processed_by_user_id,
                 actual_return_time = NOW(),
                 status = :status
             WHERE rental_id = :rental_id
               AND status = :expected_status"
        );
        $updateRental->execute([
            ':processed_by_user_id' => $officerUserId,
            ':status' => ST_LOCKER_REJECTED,
            ':rental_id' => $rentalId,
            ':expected_status' => ST_LOCKER_PENDING,
        ]);
        if ($updateRental->rowCount() !== 1) {
            throw new ServiceTrackerConflictException('This locker request was already processed. Refresh the locker list.');
        }

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'available'
             WHERE item_id = :item_id
               AND org_id = :org_id"
        );
        $updateItem->execute([
            ':item_id' => (int)$locker['item_id'],
            ':org_id' => $orgId,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    notificationEmailDispatchLockerEventBestEffort($pdo, $rentalId, 'rejected');
    return stListLockerBoard($pdo, $orgId);
}

function stSendLockerNotice(PDO $pdo, int $orgId, int $officerUserId, int $rentalId, string $noticeType = 'overdue', string $message = ''): array
{
    stRequireLockerOfficerContext($pdo);
    stSyncLockerStatuses($pdo, $orgId);

    $stmt = $pdo->prepare(
        "SELECT rental_id, renter_user_id, status, expected_return_time
         FROM rentals
         WHERE rental_id = :rental_id
           AND org_id = :org_id
           AND service_kind = :service_kind
         LIMIT 1"
    );
    $stmt->execute([
        ':rental_id' => $rentalId,
        ':org_id' => $orgId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
    ]);
    $locker = $stmt->fetch();
    if (!$locker) {
        throw new ServiceTrackerValidationException('Locker rental not found.');
    }

    $normalizedType = strtolower(trim($noticeType));
    $noticeMessage = trim($message);
    if ($noticeMessage === '') {
        throw new ServiceTrackerValidationException('A custom notice message is required.');
    }
    $noticeLength = function_exists('mb_strlen') ? mb_strlen($noticeMessage) : strlen($noticeMessage);
    if ($noticeLength > ST_LOCKER_NOTICE_MAX_LENGTH) {
        throw new ServiceTrackerValidationException('Notice message is too long.');
    }

    $updateSql = '';
    if ($normalizedType === 'upcoming') {
        if (!stIsLockerUpcomingNoticeAllowed($locker)) {
            throw new ServiceTrackerValidationException(
                'Ending soon notices can only be sent within '
                . ST_LOCKER_UPCOMING_NOTICE_WINDOW_DAYS
                . ' days before the locker rental end date.'
            );
        }
        $updateSql = "UPDATE rentals
                      SET locker_upcoming_notice_sent_at = NOW(),
                          locker_upcoming_notice_message = :message,
                          locker_upcoming_notice_sent_by_user_id = :sent_by
                      WHERE rental_id = :rental_id";
    } elseif ($normalizedType === 'overdue') {
        if ((string)$locker['status'] !== ST_LOCKER_OVERDUE) {
            throw new ServiceTrackerValidationException('Pull-out notices can only be sent for overdue locker rentals.');
        }
        $updateSql = "UPDATE rentals
                      SET locker_notice_sent_at = NOW(),
                          locker_notice_message = :message,
                          locker_notice_sent_by_user_id = :sent_by
                      WHERE rental_id = :rental_id";
    } else {
        throw new ServiceTrackerValidationException('Invalid locker notice type.');
    }

    $update = $pdo->prepare($updateSql);
    $update->execute([
        ':message' => $noticeMessage,
        ':sent_by' => $officerUserId,
        ':rental_id' => $rentalId,
    ]);

    notificationEmailDispatchLockerEventBestEffort(
        $pdo,
        $rentalId,
        $normalizedType === 'upcoming' ? 'upcoming_notice' : 'overdue_notice',
        $noticeMessage
    );
    return stListLockerBoard($pdo, $orgId);
}

function stClearLockerNotice(PDO $pdo, int $orgId, int $officerUserId, int $rentalId): array
{
    stRequireLockerOfficerContext($pdo);
    stSyncLockerStatuses($pdo, $orgId);

    $stmt = $pdo->prepare(
        "SELECT rental_id
         FROM rentals
         WHERE rental_id = :rental_id
           AND org_id = :org_id
           AND service_kind = :service_kind
         LIMIT 1"
    );
    $stmt->execute([
        ':rental_id' => $rentalId,
        ':org_id' => $orgId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
    ]);
    if (!$stmt->fetch()) {
        throw new ServiceTrackerValidationException('Locker rental not found.');
    }

    $update = $pdo->prepare(
        "UPDATE rentals
         SET locker_notice_sent_at = NULL,
             locker_notice_message = NULL,
             locker_notice_sent_by_user_id = NULL,
             locker_upcoming_notice_sent_at = NULL,
             locker_upcoming_notice_message = NULL,
             locker_upcoming_notice_sent_by_user_id = NULL,
             processed_by_user_id = :processed_by_user_id
         WHERE rental_id = :rental_id"
    );
    $update->execute([
        ':processed_by_user_id' => $officerUserId,
        ':rental_id' => $rentalId,
    ]);

    return stListLockerBoard($pdo, $orgId);
}

function stSaveLockerPricing(PDO $pdo, int $orgId, int $itemId, array $data): array
{
    stRequireLockerOfficerContext($pdo);
    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $stmt = $pdo->prepare(
        "UPDATE inventory_items
         SET locker_monthly_rate = :monthly,
             locker_semester_rate = :semester,
             locker_school_year_rate = :school_year
         WHERE org_id = :org_id
           AND category_id = :category_id"
    );
    $stmt->execute([
        ':monthly' => max(0, (float)($data['locker_monthly_rate'] ?? 0)),
        ':semester' => max(0, (float)($data['locker_semester_rate'] ?? 0)),
        ':school_year' => max(0, (float)($data['locker_school_year_rate'] ?? 0)),
        ':org_id' => $orgId,
        ':category_id' => $categoryId,
    ]);

    return stListLockerBoard($pdo, $orgId);
}

function stAddLockerItem(PDO $pdo, int $orgId, array $data): array
{
    stRequireLockerOfficerContext($pdo);
    stEnsureLockerInventory($pdo, $orgId);

    $lockerCode = stNormalizeLockerCode((string)($data['locker_code'] ?? ''));
    if (!preg_match('/^[A-Z][0-9]{2}$/', $lockerCode)) {
        throw new ServiceTrackerValidationException('Locker code must follow the format A01, B12, F03, and so on.');
    }

    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $existsStmt = $pdo->prepare(
        "SELECT item_id
         FROM inventory_items
         WHERE org_id = :org_id
           AND UPPER(TRIM(item_name)) = UPPER(TRIM(:locker_code))
         LIMIT 1"
    );
    $existsStmt->execute([
        ':org_id' => $orgId,
        ':locker_code' => $lockerCode,
    ]);
    if ($existsStmt->fetchColumn()) {
        throw new ServiceTrackerValidationException('That locker code already exists.');
    }

    $defaultRatesStmt = $pdo->prepare(
        "SELECT locker_monthly_rate, locker_semester_rate, locker_school_year_rate
         FROM inventory_items
         WHERE org_id = :org_id
           AND category_id = :category_id
         ORDER BY item_id ASC
         LIMIT 1"
    );
    $defaultRatesStmt->execute([
        ':org_id' => $orgId,
        ':category_id' => $categoryId,
    ]);
    $defaultRates = $defaultRatesStmt->fetch() ?: null;
    $monthlyRate = $defaultRates !== null
        ? max(0, (float)($defaultRates['locker_monthly_rate'] ?? 0))
        : max(0, (float)($data['locker_monthly_rate'] ?? 0));
    $semesterRate = $defaultRates !== null
        ? max(0, (float)($defaultRates['locker_semester_rate'] ?? 0))
        : max(0, (float)($data['locker_semester_rate'] ?? 0));
    $schoolYearRate = $defaultRates !== null
        ? max(0, (float)($defaultRates['locker_school_year_rate'] ?? 0))
        : max(0, (float)($data['locker_school_year_rate'] ?? 0));

    $insert = $pdo->prepare(
        "INSERT INTO inventory_items
            (org_id, item_name, barcode, image_path, category_id, hourly_rate, overtime_interval_minutes, overtime_rate_per_block, status, locker_monthly_rate, locker_semester_rate, locker_school_year_rate)
         VALUES
            (:org_id, :item_name, :barcode, NULL, :category_id, 0.00, NULL, NULL, 'available', :monthly, :semester, :school_year)"
    );
    $insert->execute([
        ':org_id' => $orgId,
        ':item_name' => $lockerCode,
        ':barcode' => $lockerCode,
        ':category_id' => $categoryId,
        ':monthly' => $monthlyRate,
        ':semester' => $semesterRate,
        ':school_year' => $schoolYearRate,
    ]);

    return stListLockerBoard($pdo, $orgId);
}
