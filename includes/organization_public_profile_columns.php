<?php
require_once __DIR__ . '/../config/db.php';

function orgPublicProfilesEnsureOrganizationColumns(PDO $pdo): void
{
    $columns = [
        'banner_url' => "ALTER TABLE organizations ADD COLUMN banner_url VARCHAR(700) DEFAULT NULL AFTER logo_url",
        'banner_gallery_json' => "ALTER TABLE organizations ADD COLUMN banner_gallery_json LONGTEXT DEFAULT NULL AFTER banner_url",
        'public_motto' => "ALTER TABLE organizations ADD COLUMN public_motto VARCHAR(255) DEFAULT NULL AFTER banner_gallery_json",
        'public_about' => "ALTER TABLE organizations ADD COLUMN public_about TEXT DEFAULT NULL AFTER public_motto",
        'contact_office' => "ALTER TABLE organizations ADD COLUMN contact_office VARCHAR(255) DEFAULT NULL AFTER public_about",
        'contact_hours' => "ALTER TABLE organizations ADD COLUMN contact_hours VARCHAR(255) DEFAULT NULL AFTER contact_office",
        'contact_email' => "ALTER TABLE organizations ADD COLUMN contact_email VARCHAR(255) DEFAULT NULL AFTER contact_hours",
        'contact_phone' => "ALTER TABLE organizations ADD COLUMN contact_phone VARCHAR(100) DEFAULT NULL AFTER contact_email",
        'contact_facebook' => "ALTER TABLE organizations ADD COLUMN contact_facebook VARCHAR(500) DEFAULT NULL AFTER contact_phone",
        'contact_instagram' => "ALTER TABLE organizations ADD COLUMN contact_instagram VARCHAR(500) DEFAULT NULL AFTER contact_facebook",
        'contact_x_url' => "ALTER TABLE organizations ADD COLUMN contact_x_url VARCHAR(500) DEFAULT NULL AFTER contact_instagram",
        'contact_tiktok' => "ALTER TABLE organizations ADD COLUMN contact_tiktok VARCHAR(500) DEFAULT NULL AFTER contact_x_url",
        'contact_summary' => "ALTER TABLE organizations ADD COLUMN contact_summary TEXT DEFAULT NULL AFTER contact_tiktok",
    ];

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'organizations'
           AND COLUMN_NAME = :column_name"
    );

    foreach ($columns as $column => $alterSql) {
        $stmt->execute([':column_name' => $column]);
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec($alterSql);
        }
    }
}
