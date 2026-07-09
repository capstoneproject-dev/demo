<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/announcements.php';

header('Content-Type: application/json');
apiGuard();

try {
    annRequireOfficerOrgContext();
    $pdo = getPdo();
    $stmt = $pdo->prepare(
        "SELECT ap.program_id,
                ap.program_code,
                i.institute_id,
                i.institute_name
         FROM academic_programs ap
         JOIN institutes i ON i.institute_id = ap.institute_id
         WHERE ap.is_active = 1
           AND i.is_active = 1
         ORDER BY i.institute_name ASC, ap.program_code ASC"
    );
    $stmt->execute();
    $items = array_map(static function (array $row): array {
        return [
            'programId' => (int)$row['program_id'],
            'programCode' => (string)$row['program_code'],
            'instituteId' => (int)$row['institute_id'],
            'instituteName' => (string)$row['institute_name'],
        ];
    }, $stmt->fetchAll());

    jsonOk(['items' => $items]);
} catch (AnnouncementAuthorizationException $e) {
    jsonError($e->getMessage(), 403);
} catch (PDOException $e) {
    error_log('[api/announcements/programs] ' . $e->getMessage());
    jsonError('A database error occurred. Please try again.', 500);
} catch (Throwable $e) {
    jsonError($e->getMessage(), 400);
}
