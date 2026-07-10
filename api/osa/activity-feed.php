<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/services_tracker.php';
require_once __DIR__ . '/../../includes/organization_public_profile_columns.php';

function osaActivityColumnExists(PDO $pdo, string $table, string $column): bool
{
    static $cache = [];
    $key = $table . '.' . $column;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
          AND COLUMN_NAME = :column_name
    ");
    $stmt->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);

    $cache[$key] = ((int)$stmt->fetchColumn()) > 0;
    return $cache[$key];
}

function osaActivityCollectSourceIds(array $rows): array
{
    $ids = [];
    foreach ($rows as $row) {
        $type = (string)($row['source_type'] ?? '');
        $id = (int)($row['source_id'] ?? 0);
        if ($type === '' || $id <= 0) {
            continue;
        }
        $ids[$type][$id] = $id;
    }

    return $ids;
}

function osaActivityFetchPayloadMap(PDO $pdo, array $ids, string $type, string $idColumn, string $sql): array
{
    if (empty($ids[$type])) {
        return [];
    }

    $sourceIds = array_values($ids[$type]);
    $placeholders = implode(',', array_fill(0, count($sourceIds), '?'));
    $stmt = $pdo->prepare(str_replace('__IDS__', $placeholders, $sql));
    $stmt->execute($sourceIds);

    $items = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $items[(int)$row[$idColumn]] = $row;
    }

    return $items;
}

function osaActivityBuildPayloads(PDO $pdo, array $rows): array
{
    $ids = osaActivityCollectSourceIds($rows);
    $payloads = [];
    $eventPhotoExpression = osaActivityColumnExists($pdo, 'events', 'event_photo')
        ? "CASE WHEN e.event_photo IS NULL THEN '' ELSE CONCAT('data:image/png;base64,', TO_BASE64(e.event_photo)) END AS media"
        : "'' AS media";

    $payloads['announcement'] = osaActivityFetchPayloadMap($pdo, $ids, 'announcement', 'announcement_id', "
        SELECT
            a.announcement_id,
            a.title,
            a.content,
            a.announcement_photo AS media,
            a.audience_type,
            a.is_published,
            a.published_at,
            a.created_at,
            a.updated_at,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM announcements a
        JOIN organizations o ON o.org_id = a.org_id
        WHERE a.announcement_id IN (__IDS__)
    ");

    $payloads['event'] = osaActivityFetchPayloadMap($pdo, $ids, 'event', 'event_id', "
        SELECT
            e.event_id,
            e.event_name,
            e.description,
            e.location,
            e.event_datetime,
            {$eventPhotoExpression},
            e.is_published,
            e.created_at,
            e.updated_at,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM events e
        JOIN organizations o ON o.org_id = e.org_id
        WHERE e.event_id IN (__IDS__)
    ");

    $payloads['event_attendance'] = osaActivityFetchPayloadMap($pdo, $ids, 'event_attendance', 'record_id', "
        SELECT
            ar.record_id,
            ar.student_name,
            ar.student_number,
            ar.section,
            ar.time_in,
            ar.time_out,
            ar.created_at,
            ar.updated_at,
            e.event_name,
            e.location,
            e.event_datetime,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM attendance_records ar
        JOIN events e ON e.event_id = ar.event_id
        JOIN organizations o ON o.org_id = e.org_id
        WHERE ar.record_id IN (__IDS__)
    ");

    $payloads['rental'] = osaActivityFetchPayloadMap($pdo, $ids, 'rental', 'rental_id', "
        SELECT
            r.rental_id,
            r.service_kind,
            r.rent_time,
            r.expected_return_time,
            r.actual_return_time,
            r.total_cost,
            r.payment_status,
            r.status,
            r.locker_period_type,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS student_name,
            u.student_number,
            COALESCE(ri_summary.items_label, 'an item') AS items_label,
            COALESCE(ri_summary.image_path, '') AS media,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM rentals r
        JOIN organizations o ON o.org_id = r.org_id
        JOIN users u ON u.user_id = r.renter_user_id
        LEFT JOIN (
            SELECT
                ri.rental_id,
                GROUP_CONCAT(CONCAT(i.item_name, ' [', i.barcode, ']') ORDER BY i.item_name SEPARATOR ', ') AS items_label,
                MIN(i.image_path) AS image_path
            FROM rental_items ri
            JOIN inventory_items i ON i.item_id = ri.item_id
            GROUP BY ri.rental_id
        ) ri_summary ON ri_summary.rental_id = r.rental_id
        WHERE r.rental_id IN (__IDS__)
    ");

    $payloads['document_submission'] = osaActivityFetchPayloadMap($pdo, $ids, 'document_submission', 'submission_id', "
        SELECT
            ds.submission_id,
            ds.title,
            ds.description,
            ds.document_type,
            ds.file_url,
            ds.recipient,
            ds.status,
            ds.reviewer_notes,
            ds.semester,
            ds.academic_year,
            ds.submitted_at,
            ds.reviewed_at,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS submitted_by,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM document_submissions ds
        JOIN organizations o ON o.org_id = ds.org_id
        LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id
        WHERE ds.submission_id IN (__IDS__)
    ");

    $payloads['repository_update'] = osaActivityFetchPayloadMap($pdo, $ids, 'repository_update', 'repo_id', "
        SELECT
            da.repo_id,
            da.submission_id,
            da.title,
            da.description,
            da.document_type,
            da.file_url,
            da.semester,
            da.academic_year,
            da.approved_at,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM documents_approved da
        JOIN organizations o ON o.org_id = da.org_id
        WHERE da.repo_id IN (__IDS__)
    ");

    $orgIds = array_unique(array_merge(
        array_values($ids['organization_info'] ?? []),
        array_values($ids['service_access'] ?? [])
    ));
    if ($orgIds) {
        $placeholders = implode(',', array_fill(0, count($orgIds), '?'));
        $stmt = $pdo->prepare("
            SELECT
                o.org_id,
                o.org_name,
                o.org_code,
                o.logo_url,
                o.banner_url,
                o.banner_gallery_json,
                o.public_motto,
                o.public_about,
                o.contact_office,
                o.contact_hours,
                o.contact_email,
                o.contact_phone,
                o.contact_facebook,
                o.contact_instagram,
                o.contact_x_url,
                o.contact_tiktok,
                o.contact_summary,
                o.can_offer_services,
                o.can_offer_printing,
                o.created_at,
                o.updated_at
            FROM organizations o
            WHERE o.org_id IN ({$placeholders})
        ");
        $stmt->execute($orgIds);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $orgId = (int)$row['org_id'];
            $payloads['organization_info'][$orgId] = $row;
            $payloads['service_access'][$orgId] = $row;
        }
    }

    $payloads['printing_request'] = osaActivityFetchPayloadMap($pdo, $ids, 'printing_request', 'print_job_id', "
        SELECT
            pj.print_job_id,
            pj.file_name,
            pj.file_url,
            pj.notes,
            pj.status,
            pj.queue_order,
            pj.submitted_at,
            pj.processing_started_at,
            pj.ready_at,
            pj.claimed_at,
            pj.updated_at,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS student_name,
            u.student_number,
            COALESCE(NULLIF(o.org_code, ''), o.org_name) AS organization
        FROM print_jobs pj
        JOIN organizations o ON o.org_id = pj.org_id
        JOIN users u ON u.user_id = pj.user_id
        WHERE pj.print_job_id IN (__IDS__)
    ");

    return $payloads;
}

try {
    $session = getPhpSession();
    $isOsa = isLoggedIn() && (($session['login_role'] ?? '') === 'osa' || ($session['account_type'] ?? '') === 'osa_staff');
    if (!$isOsa) {
        jsonError('OSA staff context required.', 403);
    }

    $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 30;
    $pdo = getPdo();
    stEnsureSchema($pdo);
    orgPublicProfilesEnsureOrganizationColumns($pdo);

    $sql = "
        SELECT *
        FROM (
            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Announcement' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(a.title USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Audience: ', a.audience_type, IF(a.is_published = 1, ' - Published', ' - Draft')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(a.published_at, a.updated_at, a.created_at) AS activity_at,
                CONVERT('announcement' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                a.announcement_id AS source_id,
                CONVERT(CONCAT(
                    'Content: ', COALESCE(a.content, 'No content provided'),
                    '\nAudience: ', a.audience_type,
                    '\nPublished: ', IF(a.is_published = 1, 'Yes', 'No'),
                    '\nPublished At: ', COALESCE(DATE_FORMAT(a.published_at, '%b %d, %Y %h:%i %p'), 'Not published'),
                    '\nCreated At: ', DATE_FORMAT(a.created_at, '%b %d, %Y %h:%i %p'),
                    '\nUpdated At: ', DATE_FORMAT(a.updated_at, '%b %d, %Y %h:%i %p')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT(IF(a.is_published = 1, 'Posted', 'Draft') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM announcements a
            JOIN organizations o ON o.org_id = a.org_id

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT(CASE
                    WHEN DATE(e.event_datetime) = CURDATE() THEN 'Event Started'
                    ELSE 'Event'
                END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(e.event_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT(COALESCE(e.location, 'Venue TBA'), ' - ', COALESCE(DATE_FORMAT(e.event_datetime, '%b %d, %Y %h:%i %p'), 'Schedule TBA')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(e.created_at, e.updated_at, e.event_datetime) AS activity_at,
                CONVERT('event' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                e.event_id AS source_id,
                CONVERT(CONCAT(
                    'Description: ', COALESCE(e.description, 'No description provided'),
                    '\nLocation: ', COALESCE(e.location, 'Venue TBA'),
                    '\nEvent Schedule: ', COALESCE(DATE_FORMAT(e.event_datetime, '%b %d, %Y %h:%i %p'), 'Schedule TBA'),
                    '\nPublished: ', IF(e.is_published = 1, 'Yes', 'No'),
                    '\nPosted At: ', DATE_FORMAT(e.created_at, '%b %d, %Y %h:%i %p'),
                    '\nUpdated At: ', DATE_FORMAT(e.updated_at, '%b %d, %Y %h:%i %p')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT(CASE
                    WHEN e.is_published = 0 THEN 'Draft'
                    WHEN DATE(e.event_datetime) = CURDATE() THEN 'Started'
                    WHEN e.event_datetime > NOW() THEN 'Upcoming'
                    ELSE 'Completed'
                END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM events e
            JOIN organizations o ON o.org_id = e.org_id

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Event Attendance' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(CONCAT(COALESCE(ar.student_name, 'Student'), ' attended ', e.event_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Student No: ', COALESCE(ar.student_number, 'N/A'), ' - Section: ', COALESCE(ar.section, 'N/A')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(ar.time_out, ar.time_in, ar.updated_at, ar.created_at) AS activity_at,
                CONVERT('event_attendance' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                ar.record_id AS source_id,
                CONVERT(CONCAT(
                    'Event: ', e.event_name,
                    '\nStudent: ', COALESCE(ar.student_name, 'Student'),
                    '\nStudent No: ', COALESCE(ar.student_number, 'N/A'),
                    '\nSection: ', COALESCE(ar.section, 'N/A'),
                    '\nTime In: ', COALESCE(DATE_FORMAT(ar.time_in, '%b %d, %Y %h:%i %p'), 'Not checked in'),
                    '\nTime Out: ', COALESCE(DATE_FORMAT(ar.time_out, '%b %d, %Y %h:%i %p'), 'Not checked out')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT(CASE
                    WHEN ar.time_out IS NOT NULL THEN 'Checked Out'
                    WHEN ar.time_in IS NOT NULL THEN 'Checked In'
                    ELSE 'Registered'
                END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM attendance_records ar
            JOIN events e ON e.event_id = ar.event_id
            JOIN organizations o ON o.org_id = e.org_id

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT(CASE WHEN r.service_kind = 'locker' THEN 'Locker Rental' ELSE 'Student Rental' END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(CONCAT(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ' rented ', COALESCE(ri_summary.items_label, 'an item')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Student No: ', COALESCE(u.student_number, 'N/A'), ' - Due: ', DATE_FORMAT(r.expected_return_time, '%b %d, %Y %h:%i %p'), ' - PHP ', FORMAT(r.total_cost, 2)) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(r.updated_at, r.rent_time, r.created_at) AS activity_at,
                CONVERT('rental' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                r.rental_id AS source_id,
                CONVERT(CONCAT(
                    'Student: ', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                    '\nStudent No: ', COALESCE(u.student_number, 'N/A'),
                    '\nItems: ', COALESCE(ri_summary.items_label, 'an item'),
                    '\nRental Type: ', IF(r.service_kind = 'locker', 'Locker', 'Item'),
                    '\nTotal Cost: PHP ', FORMAT(r.total_cost, 2),
                    '\nRented At: ', COALESCE(DATE_FORMAT(r.rent_time, '%b %d, %Y %h:%i %p'), 'N/A'),
                    '\nExpected Return: ', COALESCE(DATE_FORMAT(r.expected_return_time, '%b %d, %Y %h:%i %p'), 'N/A'),
                    '\nReturned At: ', COALESCE(DATE_FORMAT(r.actual_return_time, '%b %d, %Y %h:%i %p'), 'Not returned')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT(r.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM rentals r
            JOIN organizations o ON o.org_id = r.org_id
            JOIN users u ON u.user_id = r.renter_user_id
            LEFT JOIN (
                SELECT
                    ri.rental_id,
                    GROUP_CONCAT(CONCAT(i.item_name, ' [', i.barcode, ']') ORDER BY i.item_name SEPARATOR ', ') AS items_label
                FROM rental_items ri
                JOIN inventory_items i ON i.item_id = ri.item_id
                GROUP BY ri.rental_id
            ) ri_summary ON ri_summary.rental_id = r.rental_id

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Document Submission' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(ds.title USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT(ds.document_type, ' - Submitted by ', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(ds.updated_at, ds.submitted_at, ds.created_at) AS activity_at,
                CONVERT('document_submission' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                ds.submission_id AS source_id,
                CONVERT(CONCAT(
                    'Document Type: ', ds.document_type,
                    '\nDescription: ', COALESCE(ds.description, 'No description provided'),
                    '\nSubmitted By: ', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                    '\nRecipient: ', ds.recipient,
                    '\nSemester: ', COALESCE(ds.semester, 'N/A'),
                    '\nAcademic Year: ', COALESCE(ds.academic_year, 'N/A'),
                    '\nReviewer Notes: ', COALESCE(ds.reviewer_notes, 'None'),
                    '\nSubmitted At: ', DATE_FORMAT(ds.submitted_at, '%b %d, %Y %h:%i %p'),
                    '\nReviewed At: ', COALESCE(DATE_FORMAT(ds.reviewed_at, '%b %d, %Y %h:%i %p'), 'Not reviewed')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT(ds.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM document_submissions ds
            JOIN organizations o ON o.org_id = ds.org_id
            LEFT JOIN users u ON u.user_id = ds.submitted_by_user_id

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Repository Update' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(da.title USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT(da.document_type, ' approved into repository', IF(da.semester IS NULL, '', CONCAT(' - ', da.semester)), IF(da.academic_year IS NULL, '', CONCAT(' - ', da.academic_year))) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                da.approved_at AS activity_at,
                CONVERT('repository_update' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                da.repo_id AS source_id,
                CONVERT(CONCAT(
                    'Document Type: ', da.document_type,
                    '\nDescription: ', COALESCE(da.description, 'No description provided'),
                    '\nSemester: ', COALESCE(da.semester, 'N/A'),
                    '\nAcademic Year: ', COALESCE(da.academic_year, 'N/A'),
                    '\nApproved At: ', DATE_FORMAT(da.approved_at, '%b %d, %Y %h:%i %p')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT('Approved' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM documents_approved da
            JOIN organizations o ON o.org_id = da.org_id

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Organization Info' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT('Organization information changed' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT(
                    IF(o.logo_url IS NULL OR o.logo_url = '', '', 'Logo - '),
                    IF(o.banner_url IS NULL OR o.banner_url = '', '', 'Banner - '),
                    IF(o.public_motto IS NULL OR o.public_motto = '', '', 'Motto - '),
                    IF(o.public_about IS NULL OR o.public_about = '', '', 'About - '),
                    IF(o.contact_email IS NULL OR o.contact_email = '', '', 'Contact - '),
                    'Profile/settings updated'
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                o.updated_at AS activity_at,
                CONVERT('organization_info' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                o.org_id AS source_id,
                CONVERT(CONCAT(
                    'Organization: ', o.org_name,
                    '\nCode: ', COALESCE(o.org_code, 'N/A'),
                    '\nMotto: ', COALESCE(o.public_motto, 'N/A'),
                    '\nAbout: ', COALESCE(o.public_about, 'N/A'),
                    '\nContact Email: ', COALESCE(o.contact_email, 'N/A'),
                    '\nUpdated At: ', DATE_FORMAT(o.updated_at, '%b %d, %Y %h:%i %p')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT('Updated' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM organizations o
            WHERE o.updated_at > o.created_at

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Service Access' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT('OSA service authorization changed' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Services: ', IF(COALESCE(o.can_offer_services, 1) = 1, 'Enabled', 'Disabled'), ' - Printing: ', IF(COALESCE(o.can_offer_printing, 0) = 1, 'Enabled', 'Disabled')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                o.updated_at AS activity_at,
                CONVERT('service_access' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                o.org_id AS source_id,
                CONVERT(CONCAT(
                    'Organization: ', o.org_name,
                    '\nService Access: ', IF(COALESCE(o.can_offer_services, 1) = 1, 'Enabled', 'Disabled'),
                    '\nPrinting Access: ', IF(COALESCE(o.can_offer_printing, 0) = 1, 'Enabled', 'Disabled'),
                    '\nUpdated At: ', DATE_FORMAT(o.updated_at, '%b %d, %Y %h:%i %p')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT('Active' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM organizations o
            WHERE o.updated_at > o.created_at
              AND (COALESCE(o.can_offer_services, 1) = 1 OR COALESCE(o.can_offer_printing, 0) = 1)

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT('Printing Request' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(pj.file_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Student: ', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ' - Queue #', pj.queue_order) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(pj.updated_at, pj.submitted_at) AS activity_at,
                CONVERT('printing_request' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS source_type,
                pj.print_job_id AS source_id,
                CONVERT(CONCAT(
                    'File: ', pj.file_name,
                    '\nStudent: ', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
                    '\nQueue #: ', pj.queue_order,
                    '\nSubmitted At: ', DATE_FORMAT(pj.submitted_at, '%b %d, %Y %h:%i %p'),
                    '\nUpdated At: ', COALESCE(DATE_FORMAT(pj.updated_at, '%b %d, %Y %h:%i %p'), 'N/A')
                ) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS full_details,
                CONVERT(pj.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM print_jobs pj
            JOIN organizations o ON o.org_id = pj.org_id
            JOIN users u ON u.user_id = pj.user_id
        ) activity
        WHERE activity_at IS NOT NULL
        ORDER BY activity_at DESC
        LIMIT :limit
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $payloads = osaActivityBuildPayloads($pdo, $rows);

    $items = array_map(static function (array $row) use ($payloads): array {
        $sourceType = (string)($row['source_type'] ?? '');
        $sourceId = (int)($row['source_id'] ?? 0);

        return [
            'organization' => (string)($row['organization'] ?? ''),
            'type' => (string)($row['activity_type'] ?? ''),
            'title' => (string)($row['title'] ?? ''),
            'details' => (string)($row['details'] ?? ''),
            'date' => (string)($row['activity_at'] ?? ''),
            'sourceType' => $sourceType,
            'sourceId' => $sourceId,
            'fullDetails' => (string)($row['full_details'] ?? ''),
            'status' => (string)($row['status'] ?? ''),
            'payload' => $payloads[$sourceType][$sourceId] ?? [],
        ];
    }, $rows);

    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/osa/activity-feed] ' . $e->getMessage());
    jsonError('Could not load organization activity: ' . $e->getMessage(), 500);
}
