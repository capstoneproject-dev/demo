<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/services_tracker.php';
require_once __DIR__ . '/../../includes/organization_public_profile_columns.php';

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
                CONVERT('Rental Inventory' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(CONCAT(COUNT(*), ' rental item', IF(COUNT(*) = 1, '', 's'), ' listed/updated') USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Items: ', GROUP_CONCAT(CONCAT(i.item_name, ' [', i.barcode, ']') ORDER BY i.item_name, i.barcode SEPARATOR ', ')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(i.updated_at, i.created_at) AS activity_at,
                CONVERT(i.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status
            FROM inventory_items i
            JOIN organizations o ON o.org_id = i.org_id
            GROUP BY o.org_id, o.org_code, o.org_name, COALESCE(i.updated_at, i.created_at), i.status

            UNION ALL

            SELECT
                CONVERT(COALESCE(NULLIF(o.org_code, ''), o.org_name) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS organization,
                CONVERT(CASE WHEN r.service_kind = 'locker' THEN 'Locker Rental' ELSE 'Student Rental' END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS activity_type,
                CONVERT(CONCAT(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ' rented ', COALESCE(ri_summary.items_label, 'an item')) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS title,
                CONVERT(CONCAT('Student No: ', COALESCE(u.student_number, 'N/A'), ' - Due: ', DATE_FORMAT(r.expected_return_time, '%b %d, %Y %h:%i %p'), ' - PHP ', FORMAT(r.total_cost, 2)) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS details,
                COALESCE(r.updated_at, r.rent_time, r.created_at) AS activity_at,
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

    $items = array_map(static function (array $row): array {
        return [
            'organization' => (string)($row['organization'] ?? ''),
            'type' => (string)($row['activity_type'] ?? ''),
            'title' => (string)($row['title'] ?? ''),
            'details' => (string)($row['details'] ?? ''),
            'date' => (string)($row['activity_at'] ?? ''),
            'status' => (string)($row['status'] ?? ''),
        ];
    }, $stmt->fetchAll());

    jsonOk(['items' => $items]);
} catch (PDOException $e) {
    error_log('[api/osa/activity-feed] ' . $e->getMessage());
    jsonError('Could not load organization activity: ' . $e->getMessage(), 500);
}
