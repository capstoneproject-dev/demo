<?php
/**
 * Services tracker + printing queue domain services.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../config/db.php';

class ServiceTrackerValidationException extends RuntimeException {}
class ServiceTrackerAuthorizationException extends RuntimeException {}

const ST_DEFAULT_SERVICES = [
    [
        'service_key' => 'services',
        'service_name' => 'Services',
        'description' => 'Master switch for enabling an organization to offer services.',
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
            file_name VARCHAR(255) NOT NULL,
            file_url VARCHAR(255) NOT NULL,
            notes TEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'queued',
            queue_order INT NOT NULL DEFAULT 1,
            submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processing_started_at DATETIME NULL,
            ready_at DATETIME NULL,
            claimed_at DATETIME NULL,
            last_updated_by_user_id INT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_print_jobs_org_status_order (org_id, status, queue_order, submitted_at),
            KEY idx_print_jobs_user_status (user_id, status, submitted_at),
            CONSTRAINT fk_print_jobs_org
                FOREIGN KEY (org_id) REFERENCES organizations(org_id)
                ON DELETE CASCADE,
            CONSTRAINT fk_print_jobs_user
                FOREIGN KEY (user_id) REFERENCES users(user_id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

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
    if (empty($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new ServiceTrackerValidationException('A PDF file is required.');
    }

    $originalName = trim((string)($file['name'] ?? ''));
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if ($extension !== 'pdf') {
        throw new ServiceTrackerValidationException('Only PDF files are allowed.');
    }

    $mime = (string)($file['type'] ?? '');
    if ($mime !== '' && stripos($mime, 'pdf') === false) {
        throw new ServiceTrackerValidationException('Only PDF files are allowed.');
    }

    $targetDir = dirname(__DIR__) . '/uploads/documents';
    if (!is_dir($targetDir) && !mkdir($targetDir, 0777, true) && !is_dir($targetDir)) {
        throw new RuntimeException('Could not create upload directory.');
    }

    $safeBase = preg_replace('/[^A-Za-z0-9._-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $safeBase = trim($safeBase, '._-');
    if ($safeBase === '') {
        $safeBase = 'print_job';
    }

    $generatedName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeBase . '.pdf';
    $targetPath = $targetDir . '/' . $generatedName;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new RuntimeException('Could not store the uploaded file.');
    }

    return [
        'file_name' => $originalName,
        'file_url' => 'uploads/documents/' . $generatedName,
    ];
}

function stGetNextQueueOrder(PDO $pdo, int $orgId): int
{
    $stmt = $pdo->prepare(
        "SELECT COALESCE(MAX(queue_order), 0) + 1
         FROM print_jobs
         WHERE org_id = :org_id
           AND status = 'queued'"
    );
    $stmt->execute([':org_id' => $orgId]);
    return max(1, (int)$stmt->fetchColumn());
}

function stNormalizeQueuedOrders(PDO $pdo, int $orgId): void
{
    $stmt = $pdo->prepare(
        "SELECT print_job_id
         FROM print_jobs
         WHERE org_id = :org_id
           AND status = 'queued'
         ORDER BY queue_order ASC, submitted_at ASC, print_job_id ASC"
    );
    $stmt->execute([':org_id' => $orgId]);
    $jobs = $stmt->fetchAll();

    if (!$jobs) {
        return;
    }

    $update = $pdo->prepare(
        "UPDATE print_jobs
         SET queue_order = :queue_order
         WHERE print_job_id = :print_job_id"
    );

    $position = 1;
    foreach ($jobs as $job) {
        $update->execute([
            ':queue_order' => $position++,
            ':print_job_id' => (int)$job['print_job_id'],
        ]);
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
        $row['print_job_id'] = (int)$row['print_job_id'];
        $row['org_id'] = (int)$row['org_id'];
        $row['user_id'] = (int)$row['user_id'];
        $row['queue_order'] = (int)$row['queue_order'];
        $row['queue_position'] = strtolower((string)$row['status']) === 'queued'
            ? (int)($positionMap[(int)$row['print_job_id']] ?? 0)
            : null;
    }

    return $rows;
}

function stSubmitPrintJob(PDO $pdo, int $userId, array $data, array $file): array
{
    stEnsureSchema($pdo);
    if ($userId <= 0) {
        throw new ServiceTrackerValidationException('Invalid student account.');
    }

    $orgRef = $data['org_id'] ?? ($data['org_code'] ?? ($data['org_name'] ?? ''));
    $notes = trim((string)($data['notes'] ?? ''));
    $org = stResolveOrganizationByRef($pdo, $orgRef);
    if (!$org) {
        throw new ServiceTrackerValidationException('Selected printing provider was not found.');
    }
    $orgId = (int)$org['org_id'];

    if (!stServiceEnabledForOrg($pdo, $orgId, 'printing')) {
        throw new ServiceTrackerValidationException('Selected organization is not authorized for printing services.');
    }

    $storedFile = stStoreUploadedPrintFile($file);

    $pdo->beginTransaction();
    try {
        $queueOrder = stGetNextQueueOrder($pdo, $orgId);
        $insert = $pdo->prepare(
            "INSERT INTO print_jobs
                (org_id, user_id, file_name, file_url, notes, status, queue_order, last_updated_by_user_id)
             VALUES
                (:org_id, :user_id, :file_name, :file_url, :notes, 'queued', :queue_order, :updated_by)"
        );
        $insert->execute([
            ':org_id' => $orgId,
            ':user_id' => $userId,
            ':file_name' => $storedFile['file_name'],
            ':file_url' => $storedFile['file_url'],
            ':notes' => $notes !== '' ? $notes : null,
            ':queue_order' => $queueOrder,
            ':updated_by' => $userId,
        ]);
        $printJobId = (int)$pdo->lastInsertId();
        $pdo->commit();
        return stFetchPrintJob($pdo, $printJobId);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stListPrintJobs(PDO $pdo, array $filters = [], ?int $userScope = null, ?int $orgScope = null): array
{
    stEnsureSchema($pdo);
    $where = [];
    $params = [];

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

function stUpdatePrintJobStatus(PDO $pdo, int $orgId, int $printJobId, string $status, int $updatedByUserId): array
{
    stEnsureSchema($pdo);
    $status = strtolower(trim($status));
    $allowed = ['queued', 'processing', 'ready_to_claim', 'claimed', 'cancelled'];
    if (!in_array($status, $allowed, true)) {
        throw new ServiceTrackerValidationException('Invalid print job status.');
    }

    $current = stFetchPrintJob($pdo, $printJobId);
    if ((int)$current['org_id'] !== $orgId) {
        throw new ServiceTrackerAuthorizationException('You are not allowed to update this print job.');
    }

    $now = date('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
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
            $fields[] = 'processing_started_at = :processing_started_at';
            $params[':processing_started_at'] = $now;
        } elseif ($status === 'ready_to_claim') {
            $fields[] = 'ready_at = :ready_at';
            $params[':ready_at'] = $now;
        } elseif ($status === 'claimed') {
            $fields[] = 'claimed_at = :claimed_at';
            $params[':claimed_at'] = $now;
        }

        $stmt = $pdo->prepare(
            "UPDATE print_jobs
             SET " . implode(', ', $fields) . "
             WHERE print_job_id = :print_job_id"
        );
        $stmt->execute($params);

        if (strtolower((string)$current['status']) === 'queued' || $status === 'queued') {
            stNormalizeQueuedOrders($pdo, $orgId);
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

function stReorderPrintJob(PDO $pdo, int $orgId, int $printJobId, int $newQueueOrder): array
{
    stEnsureSchema($pdo);
    if ($newQueueOrder <= 0) {
        throw new ServiceTrackerValidationException('Queue position must be greater than zero.');
    }

    $stmt = $pdo->prepare(
        "SELECT print_job_id, queue_order, status
         FROM print_jobs
         WHERE org_id = :org_id
           AND status = 'queued'
         ORDER BY queue_order ASC, submitted_at ASC, print_job_id ASC"
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

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            "UPDATE print_jobs
             SET queue_order = :queue_order
             WHERE print_job_id = :print_job_id"
        );
        foreach ($orderedIds as $index => $jobId) {
            $update->execute([
                ':queue_order' => $index + 1,
                ':print_job_id' => $jobId,
            ]);
        }

        stNormalizeQueuedOrders($pdo, $orgId);
        $pdo->commit();
        return stFetchPrintJob($pdo, $printJobId);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function stGetStudentServicesOverview(PDO $pdo): array
{
    stEnsureSchema($pdo);
    $studentOrg = stResolveStudentOrganization($pdo);
    $studentOrgId = (int)($studentOrg['org_id'] ?? 0);
    $services = stListServiceCatalog($pdo);
    $modules = [];
    foreach ($services as $service) {
        $serviceKey = (string)($service['service_key'] ?? '');
        $providers = [];
        $enabled = false;

        if ($serviceKey === 'printing') {
            $enabled = $studentOrgId > 0 && stServiceEnabledForOrg($pdo, $studentOrgId, 'printing');
            if ($enabled && $studentOrg) {
                $providers[] = [
                    'org_id' => (int)$studentOrg['org_id'],
                    'org_name' => (string)$studentOrg['org_name'],
                    'org_code' => (string)($studentOrg['org_code'] ?? ''),
                    'logo_url' => (string)($studentOrg['logo_url'] ?? ''),
                ];
            }
        } else {
            $providers = stListAuthorizedOrganizations($pdo, $serviceKey);
            $enabled = count($providers) > 0;
        }

        $modules[] = [
            'service_key' => $serviceKey,
            'service_name' => $service['service_name'],
            'description' => $service['description'],
            'enabled' => $enabled,
            'provider_count' => count($providers),
        ];
    }

    return [
        'modules' => $modules,
        'printing_providers' => $studentOrgId > 0 && stServiceEnabledForOrg($pdo, $studentOrgId, 'printing')
            ? [[
                'org_id' => (int)$studentOrg['org_id'],
                'org_name' => (string)$studentOrg['org_name'],
                'org_code' => (string)($studentOrg['org_code'] ?? ''),
                'logo_url' => (string)($studentOrg['logo_url'] ?? ''),
            ]]
            : [],
    ];
}

function stGetLockerPeriodOptions(): array
{
    return [
        'monthly' => ['label' => 'Monthly', 'months' => 1, 'rate_column' => 'locker_monthly_rate'],
        'semester' => ['label' => 'Per Semester', 'months' => 5, 'rate_column' => 'locker_semester_rate'],
        'school_year' => ['label' => 'Whole School Year', 'months' => 10, 'rate_column' => 'locker_school_year_rate'],
        'custom' => ['label' => 'Custom Period', 'months' => null, 'rate_column' => null],
    ];
}

function stSyncLockerStatuses(PDO $pdo, int $orgId): void
{
    stEnsureLockerInventory($pdo, $orgId);

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

    $categoryId = stGetOrCreateLockerCategoryId($pdo, $orgId);
    $itemsStmt = $pdo->prepare(
        "SELECT item_id
         FROM inventory_items
         WHERE org_id = :org_id
           AND category_id = :category_id"
    );
    $itemsStmt->execute([
        ':org_id' => $orgId,
        ':category_id' => $categoryId,
    ]);
    $itemIds = array_map(static fn(array $row): int => (int)$row['item_id'], $itemsStmt->fetchAll());
    if (!$itemIds) {
        return;
    }

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

    $expectedReturn = strtotime((string)($rental['expected_return_time'] ?? ''));
    if (!$expectedReturn) {
        return false;
    }

    $now = time();
    $windowEnd = strtotime('+' . ST_LOCKER_UPCOMING_NOTICE_WINDOW_DAYS . ' days', $now);
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
                'can_send_upcoming_notice' => stIsLockerUpcomingNoticeAllowed($currentRental),
            ] + stMapLockerNoticePayload($currentRental) : null,
        ];
    }

    return ['enabled' => true, 'lockers' => $lockers];
}

function stListStudentLockers(PDO $pdo, int $userId): array
{
    $studentOrg = stResolveStudentOrganization($pdo);
    if (!$studentOrg || !stIsSscOrg($pdo, (int)$studentOrg['org_id'])) {
        return ['enabled' => false, 'lockers' => [], 'current_locker' => null];
    }

    $sscOrg = stResolveSscOrg($pdo);
    if (!$sscOrg || !stIsSscOrg($pdo, (int)$sscOrg['org_id'])) {
        return ['enabled' => false, 'lockers' => [], 'current_locker' => null];
    }

    $orgId = (int)$sscOrg['org_id'];
    $board = stListLockerBoard($pdo, $orgId);
    $currentLocker = stGetActiveLockerRentalByStudent($pdo, $userId);
    if (!$currentLocker) {
        $latestLocker = stGetLatestLockerRentalByStudent($pdo, $userId);
        if ($latestLocker && stIsReleasedLockerNoticeVisible($latestLocker)) {
            $currentLocker = $latestLocker;
        }
    }
    $currentLockerCode = $currentLocker ? (string)$currentLocker['locker_code'] : '';

    $lockers = array_map(static function (array $locker) use ($currentLockerCode): array {
        return [
            'item_id' => (int)$locker['item_id'],
            'locker_code' => (string)$locker['locker_code'],
            'column_key' => (string)$locker['column_key'],
            'slot_label' => (string)$locker['slot_label'],
            'state' => (string)$locker['state'],
            'locker_monthly_rate' => (float)($locker['locker_monthly_rate'] ?? 0),
            'locker_semester_rate' => (float)($locker['locker_semester_rate'] ?? 0),
            'locker_school_year_rate' => (float)($locker['locker_school_year_rate'] ?? 0),
            'request_allowed' => $locker['state'] === 'available' && $currentLockerCode === '',
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
            'rent_time' => (string)$currentLocker['rent_time'],
            'expected_return_time' => (string)$currentLocker['expected_return_time'],
            'total_cost' => (float)($currentLocker['total_cost'] ?? 0),
            'locker_period_type' => (string)($currentLocker['locker_period_type'] ?? ''),
            'org_name' => (string)($currentLocker['org_name'] ?? ''),
            'org_code' => (string)($currentLocker['org_code'] ?? ''),
        ] + stMapLockerNoticePayload($currentLocker) : null,
    ];
}

function stRequestLocker(PDO $pdo, int $userId, int $itemId): array
{
    $studentOrg = stResolveStudentOrganization($pdo);
    if (!$studentOrg || !stIsSscOrg($pdo, (int)$studentOrg['org_id'])) {
        throw new ServiceTrackerAuthorizationException('Locker services are only available to SSC members.');
    }

    $sscOrg = stResolveSscOrg($pdo);
    if (!$sscOrg) {
        throw new ServiceTrackerValidationException('Locker service is not available right now.');
    }
    $orgId = (int)$sscOrg['org_id'];
    if (!stIsSscOrg($pdo, $orgId)) {
        throw new ServiceTrackerAuthorizationException('Locker service is not enabled.');
    }

    stSyncLockerStatuses($pdo, $orgId);
    $existingLocker = stGetActiveLockerRentalByStudent($pdo, $userId);
    if ($existingLocker) {
        throw new ServiceTrackerValidationException('You already have a pending or active locker assignment.');
    }

    $itemStmt = $pdo->prepare(
        "SELECT i.item_id, i.item_name, i.org_id, i.locker_monthly_rate, i.locker_semester_rate, i.locker_school_year_rate
         FROM inventory_items i
         JOIN inventory_categories c ON c.category_id = i.category_id
         WHERE i.item_id = :item_id
           AND i.org_id = :org_id
           AND LOWER(TRIM(c.category_name)) = 'locker'
         LIMIT 1"
    );
    $itemStmt->execute([
        ':item_id' => $itemId,
        ':org_id' => $orgId,
    ]);
    $item = $itemStmt->fetch();
    if (!$item) {
        throw new ServiceTrackerValidationException('Selected locker was not found.');
    }

    if (stGetActiveLockerRentalByItem($pdo, $itemId)) {
        throw new ServiceTrackerValidationException('That locker is no longer available.');
    }

    $now = date('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $insertRental = $pdo->prepare(
            "INSERT INTO rentals
                (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, paid_at, status, service_kind, locker_period_type, locker_notice_sent_at, locker_notice_message, locker_notice_sent_by_user_id)
             VALUES
                (:org_id, :user_id, :processed_by_user_id, :rent_time, :expected_return_time, NULL, 0.00, 'unpaid', NULL, :status, :service_kind, 'pending', NULL, NULL, NULL)"
        );
        $insertRental->execute([
            ':org_id' => $orgId,
            ':user_id' => $userId,
            ':processed_by_user_id' => $userId,
            ':rent_time' => $now,
            ':expected_return_time' => $now,
            ':status' => ST_LOCKER_PENDING,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ]);
        $rentalId = (int)$pdo->lastInsertId();

        $insertRentalItem = $pdo->prepare(
            "INSERT INTO rental_items
                (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
             VALUES
                (:rental_id, :item_id, 1, 0.00, 0.00, NULL, NULL)"
        );
        $insertRentalItem->execute([
            ':rental_id' => $rentalId,
            ':item_id' => $itemId,
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = :status
             WHERE item_id = :item_id"
        );
        $updateItem->execute([
            ':status' => ST_LOCKER_PENDING,
            ':item_id' => $itemId,
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

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
    $startDate = new DateTime($startDateRaw . ' 00:00:00');

    if ($periodType === 'custom') {
        $endDateRaw = trim((string)($data['end_date'] ?? ''));
        if ($endDateRaw === '') {
            throw new ServiceTrackerValidationException('An end date is required for a custom locker period.');
        }
        $endDate = new DateTime($endDateRaw . ' 23:59:59');
        if ($endDate <= $startDate) {
            throw new ServiceTrackerValidationException('Locker end date must be after the start date.');
        }
        $price = (float)($data['price'] ?? 0);
    } else {
        $months = (int)$periods[$periodType]['months'];
        $endDate = clone $startDate;
        $endDate->modify('+' . $months . ' month');
        $endDate->setTime(23, 59, 59);
        $rateColumn = (string)$periods[$periodType]['rate_column'];
        $price = isset($data['price']) && $data['price'] !== '' ? (float)$data['price'] : (float)($item[$rateColumn] ?? 0);
    }

    if ($price < 0) {
        throw new ServiceTrackerValidationException('Locker price cannot be negative.');
    }

    return [
        'period_type' => $periodType,
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

    $itemStmt = $pdo->prepare(
        "SELECT i.item_id, i.item_name, i.status, i.locker_monthly_rate, i.locker_semester_rate, i.locker_school_year_rate
         FROM inventory_items i
         JOIN inventory_categories c ON c.category_id = i.category_id
         WHERE i.item_id = :item_id
           AND i.org_id = :org_id
           AND LOWER(TRIM(c.category_name)) = 'locker'
         LIMIT 1"
    );
    $itemStmt->execute([
        ':item_id' => $itemId,
        ':org_id' => $orgId,
    ]);
    $item = $itemStmt->fetch();
    if (!$item) {
        throw new ServiceTrackerValidationException('Selected locker was not found.');
    }

    if (stGetActiveLockerRentalByItem($pdo, $itemId)) {
        throw new ServiceTrackerValidationException('That locker is no longer available.');
    }

    $studentStmt = $pdo->prepare(
        "SELECT user_id, student_number
         FROM users
         WHERE user_id = :user_id
           AND account_type = 'student'
           AND is_active = 1
         LIMIT 1"
    );
    $studentStmt->execute([':user_id' => $studentUserId]);
    $student = $studentStmt->fetch();
    if (!$student) {
        throw new ServiceTrackerValidationException('Selected student was not found.');
    }

    if (stGetActiveLockerRentalByStudent($pdo, $studentUserId)) {
        throw new ServiceTrackerValidationException('That student already has an active locker assignment.');
    }

    $computed = stComputeLockerDatesAndPrice($item, $data);

    $pdo->beginTransaction();
    try {
        $insertRental = $pdo->prepare(
            "INSERT INTO rentals
                (org_id, renter_user_id, processed_by_user_id, rent_time, expected_return_time, actual_return_time, total_cost, payment_status, paid_at, status, service_kind, locker_period_type, locker_notice_sent_at, locker_notice_message, locker_notice_sent_by_user_id, locker_upcoming_notice_sent_at, locker_upcoming_notice_message, locker_upcoming_notice_sent_by_user_id)
             VALUES
                (:org_id, :user_id, :processed_by_user_id, :rent_time, :expected_return_time, NULL, :total_cost, 'unpaid', NULL, :status, :service_kind, :locker_period_type, NULL, NULL, NULL, NULL, NULL, NULL)"
        );
        $insertRental->execute([
            ':org_id' => $orgId,
            ':user_id' => $studentUserId,
            ':processed_by_user_id' => $officerUserId,
            ':rent_time' => $computed['start_at'],
            ':expected_return_time' => $computed['end_at'],
            ':total_cost' => $computed['price'],
            ':status' => ST_LOCKER_ACTIVE,
            ':service_kind' => ST_LOCKER_SERVICE_KIND,
            ':locker_period_type' => $computed['period_type'],
        ]);
        $rentalId = (int)$pdo->lastInsertId();

        $insertRentalItem = $pdo->prepare(
            "INSERT INTO rental_items
                (rental_id, item_id, quantity, unit_rate, item_cost, overtime_interval_minutes, overtime_rate_per_block)
             VALUES
                (:rental_id, :item_id, 1, :unit_rate, :item_cost, NULL, NULL)"
        );
        $insertRentalItem->execute([
            ':rental_id' => $rentalId,
            ':item_id' => $itemId,
            ':unit_rate' => $computed['price'],
            ':item_cost' => $computed['price'],
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'locker_occupied'
             WHERE item_id = :item_id"
        );
        $updateItem->execute([':item_id' => $itemId]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    stSyncLockerStatuses($pdo, $orgId);
    return stListLockerBoard($pdo, $orgId);
}

function stApproveLockerRequest(PDO $pdo, int $orgId, int $officerUserId, int $rentalId, array $data): array
{
    stRequireLockerOfficerContext($pdo);
    stSyncLockerStatuses($pdo, $orgId);

    $stmt = $pdo->prepare(
        "SELECT r.*, ri.item_id, i.item_name, i.locker_monthly_rate, i.locker_semester_rate, i.locker_school_year_rate
         FROM rentals r
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         JOIN inventory_items i ON i.item_id = ri.item_id
         WHERE r.rental_id = :rental_id
           AND r.org_id = :org_id
           AND r.service_kind = :service_kind
         LIMIT 1"
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
        throw new ServiceTrackerValidationException('Only pending locker requests can be approved.');
    }

    $computed = stComputeLockerDatesAndPrice($locker, $data);

    $pdo->beginTransaction();
    try {
        $updateRental = $pdo->prepare(
            "UPDATE rentals
             SET processed_by_user_id = :processed_by_user_id,
                 rent_time = :rent_time,
                 expected_return_time = :expected_return_time,
                 total_cost = :total_cost,
                 status = :status,
                 locker_period_type = :locker_period_type,
                 locker_notice_sent_at = NULL,
                 locker_notice_message = NULL,
                 locker_notice_sent_by_user_id = NULL,
                 locker_upcoming_notice_sent_at = NULL,
                 locker_upcoming_notice_message = NULL,
                 locker_upcoming_notice_sent_by_user_id = NULL
             WHERE rental_id = :rental_id"
        );
        $updateRental->execute([
            ':processed_by_user_id' => $officerUserId,
            ':rent_time' => $computed['start_at'],
            ':expected_return_time' => $computed['end_at'],
            ':total_cost' => $computed['price'],
            ':status' => ST_LOCKER_ACTIVE,
            ':locker_period_type' => $computed['period_type'],
            ':rental_id' => $rentalId,
        ]);

        $updateRentalItem = $pdo->prepare(
            "UPDATE rental_items
             SET unit_rate = :unit_rate,
                 item_cost = :item_cost
             WHERE rental_id = :rental_id"
        );
        $updateRentalItem->execute([
            ':unit_rate' => $computed['price'],
            ':item_cost' => $computed['price'],
            ':rental_id' => $rentalId,
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'locker_occupied'
             WHERE item_id = :item_id"
        );
        $updateItem->execute([':item_id' => (int)$locker['item_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    stSyncLockerStatuses($pdo, $orgId);
    return stListLockerBoard($pdo, $orgId);
}

function stReleaseLocker(PDO $pdo, int $orgId, int $officerUserId, int $rentalId): array
{
    stRequireLockerOfficerContext($pdo);
    $releaseNotice = 'Locker has been pulled out. If you left any items inside the locker, you may claim them at the SSC office. This notice will remain visible for 2 weeks or until you rent another locker.';
    $stmt = $pdo->prepare(
        "SELECT r.rental_id, ri.item_id
         FROM rentals r
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         WHERE r.rental_id = :rental_id
           AND r.org_id = :org_id
           AND r.service_kind = :service_kind
           AND r.status IN (:active_status, :overdue_status)
         LIMIT 1"
    );
    $stmt->execute([
        ':rental_id' => $rentalId,
        ':org_id' => $orgId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ':active_status' => ST_LOCKER_ACTIVE,
        ':overdue_status' => ST_LOCKER_OVERDUE,
    ]);
    $locker = $stmt->fetch();
    if (!$locker) {
        throw new ServiceTrackerValidationException('Active locker assignment not found.');
    }

    $pdo->beginTransaction();
    try {
        $updateRental = $pdo->prepare(
            "UPDATE rentals
             SET processed_by_user_id = :processed_by_user_id,
                 actual_return_time = NOW(),
                 status = :status,
                 locker_notice_sent_at = NOW(),
                 locker_notice_message = :locker_notice_message,
                 locker_notice_sent_by_user_id = :locker_notice_sent_by_user_id
             WHERE rental_id = :rental_id"
        );
        $updateRental->execute([
            ':processed_by_user_id' => $officerUserId,
            ':status' => ST_LOCKER_RELEASED,
            ':locker_notice_message' => $releaseNotice,
            ':locker_notice_sent_by_user_id' => $officerUserId,
            ':rental_id' => $rentalId,
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'available'
             WHERE item_id = :item_id"
        );
        $updateItem->execute([':item_id' => (int)$locker['item_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return stListLockerBoard($pdo, $orgId);
}

function stRejectLockerRequest(PDO $pdo, int $orgId, int $officerUserId, int $rentalId): array
{
    stRequireLockerOfficerContext($pdo);
    $stmt = $pdo->prepare(
        "SELECT r.rental_id, ri.item_id
         FROM rentals r
         JOIN rental_items ri ON ri.rental_id = r.rental_id
         WHERE r.rental_id = :rental_id
           AND r.org_id = :org_id
           AND r.service_kind = :service_kind
           AND r.status = :pending_status
         LIMIT 1"
    );
    $stmt->execute([
        ':rental_id' => $rentalId,
        ':org_id' => $orgId,
        ':service_kind' => ST_LOCKER_SERVICE_KIND,
        ':pending_status' => ST_LOCKER_PENDING,
    ]);
    $locker = $stmt->fetch();
    if (!$locker) {
        throw new ServiceTrackerValidationException('Pending locker request not found.');
    }

    $pdo->beginTransaction();
    try {
        $updateRental = $pdo->prepare(
            "UPDATE rentals
             SET processed_by_user_id = :processed_by_user_id,
                 actual_return_time = NOW(),
                 status = :status
             WHERE rental_id = :rental_id"
        );
        $updateRental->execute([
            ':processed_by_user_id' => $officerUserId,
            ':status' => ST_LOCKER_RELEASED,
            ':rental_id' => $rentalId,
        ]);

        $updateItem = $pdo->prepare(
            "UPDATE inventory_items
             SET status = 'available'
             WHERE item_id = :item_id"
        );
        $updateItem->execute([':item_id' => (int)$locker['item_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

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
        if ((string)$locker['status'] !== ST_LOCKER_ACTIVE) {
            throw new ServiceTrackerValidationException('Ending soon notices can only be sent for active locker rentals.');
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
