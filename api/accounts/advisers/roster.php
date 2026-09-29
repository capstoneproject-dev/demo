<?php
declare(strict_types=1);

function adviserRows(PDO $pdo): array
{
    return $pdo->query("SELECT u.employee_number AS employeeNumber, u.first_name AS firstName,
        u.last_name AS lastName, u.email, COALESCE(u.phone, '') AS phone,
        u.is_active AS isActive, COALESCE(o.org_code, '') AS orgCode,
        COALESCE(o.org_name, '') AS orgName, COALESCE(om.joined_at, '') AS joinedAt,
        COALESCE(om.is_active, 0) AS membershipActive
        FROM users u LEFT JOIN organization_members om ON om.user_id = u.user_id
        LEFT JOIN organizations o ON o.org_id = om.org_id
        WHERE u.account_type = 'organization_adviser' AND u.is_active = 1
          AND (om.membership_id IS NULL OR om.is_active = 1)
        ORDER BY u.employee_number, o.org_code")->fetchAll();
}

function adviserExportRows(PDO $pdo): array
{
    return $pdo->query("SELECT u.employee_number AS employeeNumber, u.first_name AS firstName,
        u.last_name AS lastName, u.email, COALESCE(u.phone, '') AS phone,
        u.is_active AS isActive, COALESCE(o.org_code, '') AS orgCode,
        COALESCE(o.org_name, '') AS orgName, COALESCE(om.joined_at, '') AS joinedAt,
        COALESCE(om.is_active, 0) AS membershipActive
        FROM users u LEFT JOIN organization_members om ON om.user_id = u.user_id AND om.is_active = 1
        LEFT JOIN organizations o ON o.org_id = om.org_id
        WHERE u.account_type = 'organization_adviser' AND u.is_active = 1
        ORDER BY u.employee_number, o.org_code")->fetchAll();
}

function validateAdviserRows(PDO $pdo, array $rows): array
{
    $result = [];
    $seen = [];
    $accounts = [];
    $emails = [];
    foreach ($rows as $index => $row) {
        $label = 'Advisers row ' . ($index + 2);
        if (!is_array($row)) throw new InvalidArgumentException("$label is invalid.");
        $item = [];
        foreach (['employeeNumber', 'firstName', 'lastName', 'email', 'phone', 'orgCode', 'joinedAt'] as $field) {
            $item[$field] = trim((string)($row[$field] ?? ''));
        }
        foreach (['employeeNumber' => 20, 'firstName' => 100, 'lastName' => 100, 'email' => 255, 'phone' => 30] as $field => $limit) {
            if (strlen($item[$field]) > $limit) throw new InvalidArgumentException("$label: $field is too long.");
        }
        if (!$item['employeeNumber'] || !$item['firstName'] || !$item['lastName'] || !filter_var($item['email'], FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("$label requires employeeNumber, firstName, lastName, and a valid email.");
        }
        foreach (['isActive', 'membershipActive'] as $field) {
            $raw = $row[$field] ?? 'true';
            $value = is_bool($raw) ? ($raw ? 'true' : 'false') : strtolower(trim((string)$raw));
            if (!in_array($value, ['true','false','1','0','yes','no','active','inactive'], true)) {
                throw new InvalidArgumentException("$label: invalid $field.");
            }
            $item[$field] = in_array($value, ['true','1','yes','active'], true) ? 1 : 0;
        }
        $key = strtolower($item['employeeNumber']);
        $identity = [$item['firstName'], $item['lastName'], $item['email'], $item['phone'], $item['isActive']];
        if (isset($accounts[$key]) && $accounts[$key] !== $identity) throw new InvalidArgumentException("$label: conflicting details for the same employee.");
        $accounts[$key] = $identity;
        $emailKey = strtolower($item['email']);
        if (isset($emails[$emailKey]) && $emails[$emailKey] !== $key) throw new InvalidArgumentException("$label: email is shared by different employees.");
        $emails[$emailKey] = $key;
        $pair = $key . '|' . strtolower($item['orgCode']);
        if (isset($seen[$pair])) throw new InvalidArgumentException("$label duplicates an employee/organization pair.");
        $seen[$pair] = true;
        $stmt = $pdo->prepare('SELECT user_id, account_type FROM users WHERE employee_number = ?');
        $stmt->execute([$item['employeeNumber']]);
        $old = $stmt->fetch();
        if ($old && $old['account_type'] !== 'organization_adviser') throw new InvalidArgumentException("$label: employee number belongs to another account type.");
        $item['userId'] = $old ? (int)$old['user_id'] : 0;
        $stmt = $pdo->prepare('SELECT user_id FROM users WHERE email = ? AND user_id <> ?');
        $stmt->execute([$item['email'], $item['userId']]);
        if ($stmt->fetch()) throw new InvalidArgumentException("$label: email already belongs to another account.");
        $item['orgId'] = null;
        if ($item['orgCode'] !== '') {
            $stmt = $pdo->prepare('SELECT org_id FROM organizations WHERE org_code = ?');
            $stmt->execute([$item['orgCode']]);
            $id = $stmt->fetchColumn();
            if (!$id) throw new InvalidArgumentException("$label: unknown organization code.");
            $item['orgId'] = (int)$id;
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $item['joinedAt']);
            if (!$date || $date->format('Y-m-d') !== $item['joinedAt']) throw new InvalidArgumentException("$label: joinedAt must be YYYY-MM-DD.");
        }
        $result[] = $item;
    }
    return $result;
}

function adviserChangePreview(PDO $pdo, array $rows): array
{
    $changes = ['new' => [], 'updated' => [], 'reactivated' => [], 'unchanged' => []];
    $byEmployee = [];
    $userQuery = $pdo->prepare("SELECT user_id, first_name, last_name, email, COALESCE(phone, '') AS phone, is_active
        FROM users WHERE employee_number = ? AND account_type = 'organization_adviser'");
    $membershipQuery = $pdo->prepare('SELECT joined_at, is_active FROM organization_members WHERE user_id = ? AND org_id = ?');
    foreach ($rows as $row) {
        $key = strtolower($row['employeeNumber']);
        if (!isset($byEmployee[$key])) {
            $userQuery->execute([$row['employeeNumber']]);
            $old = $userQuery->fetch();
            $status = !$old ? 'new' : ((int)$old['is_active'] === 0 && $row['isActive'] === 1 ? 'reactivated' : 'unchanged');
            if ($old && $status === 'unchanged') {
                foreach (['first_name' => 'firstName', 'last_name' => 'lastName', 'email' => 'email', 'phone' => 'phone', 'is_active' => 'isActive'] as $column => $field) {
                    if ((string)$old[$column] !== (string)$row[$field]) { $status = 'updated'; break; }
                }
            }
            $byEmployee[$key] = [
                'employeeNumber' => $row['employeeNumber'],
                'name' => trim($row['firstName'] . ' ' . $row['lastName']),
                'orgCodes' => [], 'status' => $status,
            ];
        }
        if ($row['orgId'] !== null) {
            $byEmployee[$key]['orgCodes'][] = $row['orgCode'];
            if ($byEmployee[$key]['status'] === 'new') continue;
            $membershipQuery->execute([$row['userId'], $row['orgId']]);
            $oldMembership = $membershipQuery->fetch();
            if ($oldMembership && (int)$oldMembership['is_active'] === 0 && $row['membershipActive'] === 1) {
                $byEmployee[$key]['status'] = 'reactivated';
            } elseif (!$oldMembership || (string)$oldMembership['joined_at'] !== $row['joinedAt'] ||
                (int)$oldMembership['is_active'] !== $row['membershipActive']) {
                if ($byEmployee[$key]['status'] === 'unchanged') $byEmployee[$key]['status'] = 'updated';
            }
        }
    }
    foreach ($byEmployee as $item) {
        $status = $item['status'];
        unset($item['status']);
        $changes[$status][] = $item;
    }
    return $changes;
}

function applyAdviserRows(PDO $pdo, array $rows): void
{
    foreach ($rows as $row) {
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE employee_number = ? AND account_type = 'organization_adviser'");
        $stmt->execute([$row['employeeNumber']]);
        $userId = $stmt->fetchColumn();
        if (!$userId) {
            // New accounts use password recovery to set their own password.
            $stmt = $pdo->prepare("INSERT INTO users (employee_number, first_name, last_name, email, phone, is_active, account_type, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, 'organization_adviser', ?)");
            $stmt->execute([$row['employeeNumber'], $row['firstName'], $row['lastName'], $row['email'], $row['phone'], $row['isActive'], password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT)]);
            $userId = $pdo->lastInsertId();
        } else {
            $pdo->prepare('UPDATE users SET first_name=?, last_name=?, email=?, phone=?, is_active=? WHERE user_id=?')
                ->execute([$row['firstName'], $row['lastName'], $row['email'], $row['phone'], $row['isActive'], $userId]);
        }
        if ($row['orgId'] === null) continue;
        $pdo->prepare("INSERT INTO org_roles (org_id, role_name, can_access_org_dashboard, can_manage_org_dashboard, can_review_org_documents, is_active)
            VALUES (?, 'organization_adviser', 1, 0, 1, 1)
            ON DUPLICATE KEY UPDATE can_access_org_dashboard=1, can_manage_org_dashboard=0, can_review_org_documents=1, is_active=1")
            ->execute([$row['orgId']]);
        $stmt = $pdo->prepare("SELECT role_id FROM org_roles WHERE org_id=? AND role_name='organization_adviser'");
        $stmt->execute([$row['orgId']]);
        $roleId = $stmt->fetchColumn();
        $pdo->prepare("INSERT INTO organization_members (user_id, org_id, role_id, position_title, joined_at, is_active)
            VALUES (?, ?, ?, 'Organization Adviser', ?, ?)
            ON DUPLICATE KEY UPDATE role_id=VALUES(role_id), joined_at=VALUES(joined_at), is_active=VALUES(is_active)")
            ->execute([$userId, $row['orgId'], $roleId, $row['joinedAt'], $row['membershipActive']]);
    }
}

function adviserOmissions(PDO $pdo, array $rows): array
{
    $listedAccounts = [];
    $listedMemberships = [];
    foreach ($rows as $row) {
        $employee = strtolower($row['employeeNumber']);
        $listedAccounts[$employee] = true;
        if ($row['orgId'] !== null) $listedMemberships[$employee . '|' . $row['orgId']] = true;
    }
    $accounts = [];
    $memberships = [];
    $existing = $pdo->query("SELECT u.user_id, u.employee_number, u.first_name, u.last_name, u.is_active,
        om.membership_id, om.org_id, om.is_active AS membership_active, o.org_code
        FROM users u LEFT JOIN organization_members om ON om.user_id = u.user_id
        LEFT JOIN organizations o ON o.org_id = om.org_id
        WHERE u.account_type = 'organization_adviser'")->fetchAll();
    foreach ($existing as $row) {
        $employee = strtolower((string)$row['employee_number']);
        if (!isset($listedAccounts[$employee]) && (int)$row['is_active'] === 1) {
            $accounts[(int)$row['user_id']] = [
                'userId' => (int)$row['user_id'],
                'employeeNumber' => $row['employee_number'],
                'name' => trim($row['first_name'] . ' ' . $row['last_name']),
            ];
        }
        if ($row['membership_id'] !== null && (int)$row['membership_active'] === 1 &&
            !isset($listedMemberships[$employee . '|' . $row['org_id']])) {
            $memberships[(int)$row['membership_id']] = [
                'membershipId' => (int)$row['membership_id'],
                'employeeNumber' => $row['employee_number'],
                'name' => trim($row['first_name'] . ' ' . $row['last_name']),
                'orgCode' => $row['org_code'],
            ];
        }
    }
    return ['accounts' => array_values($accounts), 'memberships' => array_values($memberships)];
}

function deactivateOmittedAdvisers(PDO $pdo, array $omissions): void
{
    $account = $pdo->prepare("UPDATE users SET is_active = 0 WHERE user_id = ? AND account_type = 'organization_adviser'");
    foreach ($omissions['accounts'] as $row) $account->execute([$row['userId']]);
    $membership = $pdo->prepare('UPDATE organization_members SET is_active = 0 WHERE membership_id = ?');
    foreach ($omissions['memberships'] as $row) $membership->execute([$row['membershipId']]);
}
