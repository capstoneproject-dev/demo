<?php
declare(strict_types=1);

function officerSaveStudentUserId(PDO $pdo, int $membershipId, string $studentNumber): ?int
{
    if ($membershipId > 0) {
        $stmt = $pdo->prepare("SELECT om.user_id
            FROM organization_members om
            JOIN users u ON u.user_id = om.user_id
            WHERE om.membership_id = :mid AND u.account_type = 'student'");
        $stmt->execute([':mid' => $membershipId]);
        $currentUserId = $stmt->fetchColumn();
        if (!$currentUserId) return null;
        if ($studentNumber === '') return (int)$currentUserId;
    }

    $stmt = $pdo->prepare("SELECT user_id FROM users
        WHERE student_number = :sn AND account_type = 'student' LIMIT 1");
    $stmt->execute([':sn' => $studentNumber]);
    $userId = $stmt->fetchColumn();
    return $userId ? (int)$userId : null;
}
