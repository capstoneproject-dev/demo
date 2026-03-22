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
         ADD COLUMN IF NOT EXISTS can_offer_printing TINYINT(1) NOT NULL DEFAULT 0"
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
        "SELECT org_id, org_name, org_code, status, COALESCE(can_offer_printing, 0) AS can_offer_printing
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
                'rentals' => ((string)($row['status'] ?? '')) === 'active',
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
         SET can_offer_printing = :can_offer_printing
         WHERE org_id = :org_id"
    );
    $stmt->execute([
        ':can_offer_printing' => !empty($services['printing']) ? 1 : 0,
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
    $services = stListServiceCatalog($pdo);
    $modules = [];
    foreach ($services as $service) {
        $providers = stListAuthorizedOrganizations($pdo, $service['service_key']);
        $modules[] = [
            'service_key' => $service['service_key'],
            'service_name' => $service['service_name'],
            'description' => $service['description'],
            'enabled' => count($providers) > 0,
            'provider_count' => count($providers),
        ];
    }

    return [
        'modules' => $modules,
        'printing_providers' => stListAuthorizedOrganizations($pdo, 'printing'),
    ];
}
