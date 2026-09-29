<?php
declare(strict_types=1);

function officerDeleteStudentMembership(PDO $pdo, int $membershipId): bool
{
    $stmt = $pdo->prepare("DELETE FROM organization_members
        WHERE membership_id = :mid
          AND user_id IN (SELECT user_id FROM users WHERE account_type = 'student')");
    $stmt->execute([':mid' => $membershipId]);
    return $stmt->rowCount() > 0;
}
