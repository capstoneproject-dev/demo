<?php
declare(strict_types=1);

/** Validate every officer before any enrollment change is committed. */
function validateOfficerWorkbook(PDO $pdo, array $rows): array
{
    $result = [];
    $seenMemberships = [];
    $seenPairs = [];
    foreach (array_values($rows) as $index => $row) {
        $label = 'Officers sheet row ' . ($index + 2);
        if (!is_array($row)) throw new InvalidArgumentException("$label is invalid.");
        $idText = trim((string)($row['officerId'] ?? ''));
        if ($idText !== '' && (!ctype_digit($idText) || (int)$idText < 1)) {
            throw new InvalidArgumentException("$label has an invalid officerId.");
        }
        $membershipId = $idText === '' ? 0 : (int)$idText;
        $existing = null;
        if ($membershipId) {
            $stmt = $pdo->prepare("SELECT om.membership_id, om.user_id, om.org_id, om.joined_at,
                u.student_number FROM organization_members om
                JOIN users u ON u.user_id = om.user_id
                WHERE om.membership_id = ? AND u.account_type <> 'organization_adviser'");
            $stmt->execute([$membershipId]);
            $existing = $stmt->fetch();
            if (!$existing) throw new InvalidArgumentException("$label: officerId does not match an existing officer.");
            if (isset($seenMemberships[$membershipId])) throw new InvalidArgumentException("$label duplicates another officerId.");
            $seenMemberships[$membershipId] = true;
        }

        $studentId = trim((string)($row['studentId'] ?? ''));
        $orgCode = trim((string)($row['orgCode'] ?? ''));
        $roleName = trim((string)($row['roleName'] ?? ''));
        $positionTitle = trim((string)($row['positionTitle'] ?? ''));
        $joinedAt = trim((string)($row['joinedAt'] ?? ''));
        if ($studentId === '' && $existing) $studentId = (string)($existing['student_number'] ?? '');
        if ($joinedAt === '' && $existing) $joinedAt = (string)$existing['joined_at'];
        if (!$existing && $studentId === '') throw new InvalidArgumentException("$label requires a studentId or an existing officerId.");
        if ($orgCode === '' || $roleName === '') throw new InvalidArgumentException("$label requires orgCode and roleName.");
        if (strlen($studentId) > 20 || strlen($orgCode) > 20 || strlen($roleName) > 50 || strlen($positionTitle) > 120) {
            throw new InvalidArgumentException("$label contains a value that is too long.");
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $joinedAt);
        if (!$date || $date->format('Y-m-d') !== $joinedAt) throw new InvalidArgumentException("$label requires joinedAt in YYYY-MM-DD format.");
        $status = $row['isActive'] ?? true;
        if (!is_bool($status) && !in_array(strtolower(trim((string)$status)), ['1', '0', 'true', 'false', 'yes', 'no', 'active', 'inactive'], true)) {
            throw new InvalidArgumentException("$label has an invalid isActive value.");
        }
        $active = is_bool($status) ? $status : in_array(strtolower(trim((string)$status)), ['1', 'true', 'yes', 'active'], true);

        if ($studentId !== '') {
            $stmt = $pdo->prepare("SELECT user_id FROM users WHERE student_number = ? AND account_type = 'student'");
            $stmt->execute([$studentId]);
            $userId = $stmt->fetchColumn();
            if (!$userId) throw new InvalidArgumentException("$label: student account '$studentId' was not found.");
            $userId = (int)$userId;
        } else {
            $userId = (int)$existing['user_id'];
        }
        $stmt = $pdo->prepare('SELECT org_id FROM organizations WHERE org_code = ?');
        $stmt->execute([$orgCode]);
        $orgId = $stmt->fetchColumn();
        if (!$orgId) throw new InvalidArgumentException("$label: organization '$orgCode' was not found. No changes were saved.");
        $orgId = (int)$orgId;
        $pair = "$userId:$orgId";
        if (isset($seenPairs[$pair])) throw new InvalidArgumentException("$label duplicates another student/organization pair.");
        $seenPairs[$pair] = true;
        $stmt = $pdo->prepare('SELECT membership_id FROM organization_members WHERE user_id = ? AND org_id = ?');
        $stmt->execute([$userId, $orgId]);
        $pairId = $stmt->fetchColumn();
        if ($pairId && (!$membershipId || (int)$pairId !== $membershipId)) {
            throw new InvalidArgumentException("$label: this student already belongs to '$orgCode'.");
        }
        $result[] = compact('membershipId', 'userId', 'orgId', 'roleName', 'positionTitle', 'joinedAt', 'active');
    }
    return $result;
}

function officerChangePreview(PDO $pdo, array $rows): array
{
    $changes = ['new' => [], 'updated' => [], 'reactivated' => [], 'unchanged' => []];
    $findOfficer = $pdo->prepare('SELECT om.user_id, om.org_id, om.position_title, om.joined_at, om.is_active, r.role_name
        FROM organization_members om JOIN org_roles r ON r.role_id = om.role_id WHERE om.membership_id = ?');
    $findUser = $pdo->prepare('SELECT student_number, first_name, last_name FROM users WHERE user_id = ?');
    $findOrg = $pdo->prepare('SELECT org_code FROM organizations WHERE org_id = ?');
    foreach ($rows as $row) {
        $status = 'new';
        if ($row['membershipId']) {
            $findOfficer->execute([$row['membershipId']]);
            $old = $findOfficer->fetch();
            if (!$old) throw new InvalidArgumentException('An officer changed during preview. Please retry.');
            $status = 'unchanged';
            if (!(bool)$old['is_active'] && $row['active']) {
                $status = 'reactivated';
            } elseif ((int)$old['user_id'] !== $row['userId'] || (int)$old['org_id'] !== $row['orgId'] ||
                (string)$old['role_name'] !== $row['roleName'] ||
                (string)($old['position_title'] ?? '') !== $row['positionTitle'] ||
                (string)$old['joined_at'] !== $row['joinedAt'] || (bool)$old['is_active'] !== $row['active']) {
                $status = 'updated';
            }
        }
        $findUser->execute([$row['userId']]);
        $user = $findUser->fetch();
        $findOrg->execute([$row['orgId']]);
        $changes[$status][] = [
            'studentId' => $user['student_number'] ?? '',
            'name' => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')),
            'orgCode' => (string)$findOrg->fetchColumn(),
            'roleName' => $row['roleName'],
        ];
    }
    return $changes;
}

/** Called inside the same transaction as student and adviser changes. */
function applyOfficerWorkbook(PDO $pdo, array $rows): array
{
    $counts = ['added' => 0, 'updated' => 0];
    $findRole = $pdo->prepare('SELECT role_id FROM org_roles WHERE org_id = ? AND role_name = ?');
    $createRole = $pdo->prepare('INSERT INTO org_roles (org_id, role_name, can_access_org_dashboard) VALUES (?, ?, 0)');
    $insert = $pdo->prepare('INSERT INTO organization_members (user_id, org_id, role_id, position_title, joined_at, is_active) VALUES (?, ?, ?, ?, ?, ?)');
    $update = $pdo->prepare('UPDATE organization_members SET user_id=?, org_id=?, role_id=?, position_title=?, joined_at=?, is_active=? WHERE membership_id=?');
    foreach ($rows as $row) {
        $findRole->execute([$row['orgId'], $row['roleName']]);
        $roleId = $findRole->fetchColumn();
        if (!$roleId) {
            $createRole->execute([$row['orgId'], $row['roleName']]);
            $roleId = $pdo->lastInsertId();
        }
        $params = [$row['userId'], $row['orgId'], $roleId, $row['positionTitle'] ?: null, $row['joinedAt'], $row['active'] ? 1 : 0];
        if ($row['membershipId']) {
            $update->execute([...$params, $row['membershipId']]);
            $counts['updated']++;
        } else {
            $insert->execute($params);
            $counts['added']++;
        }
    }
    return $counts;
}
