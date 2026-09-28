<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../includes/system_settings.php';

function rosterParseAcademicYear(mixed $value, string $activeAcademicYear): string
{
    if ($value === null) return $activeAcademicYear;
    if (!is_string($value) && !is_int($value)) {
        throw new InvalidArgumentException('Invalid academicYear value. Use YYYY-YYYY.');
    }
    $year = trim((string)$value);
    return $year === '' ? $activeAcademicYear : settingsValidateAcademicYear($year);
}

function rosterParseActiveStatus(mixed $value): bool
{
    if (is_bool($value)) return $value;
    if (is_int($value) && ($value === 0 || $value === 1)) return $value === 1;
    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if (in_array($normalized, ['true', '1', 'yes', 'active'], true)) return true;
        if (in_array($normalized, ['false', '0', 'no', 'inactive'], true)) return false;
    }
    throw new InvalidArgumentException('Invalid isActive value. Use true or false.');
}
