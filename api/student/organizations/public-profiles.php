<?php
require_once __DIR__ . '/../../../includes/auth.php';
require_once __DIR__ . '/../../../includes/organization_public_profile_columns.php';

header('Content-Type: application/json');
apiGuard();

try {
    $pdo = getPdo();
    orgPublicProfilesEnsureOrganizationColumns($pdo);

    $stmt = $pdo->query(
        "SELECT org_id,
                org_name,
                org_code,
                logo_url,
                banner_url,
                banner_gallery_json,
                public_motto,
                public_about,
                contact_office,
                contact_hours,
                contact_email,
                contact_phone,
                contact_facebook,
                contact_instagram,
                contact_x_url,
                contact_tiktok,
                contact_summary,
                updated_at
         FROM organizations
         WHERE status != 'suspended'
         ORDER BY org_name ASC"
    );

    jsonOk(['profiles' => $stmt->fetchAll()]);
} catch (PDOException $e) {
    error_log('[api/student/organizations/public-profiles] ' . $e->getMessage());
    jsonError('Could not load organization profiles right now.', 500);
}
