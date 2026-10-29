<?php

function normalizeOsaEmployeeNumber(string $value): string
{
    $value = preg_replace('/^\s+|\s+$/u', '', $value) ?? $value;
    return function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
}

function isValidOsaEmployeeNumber(string $value): bool
{
    return (bool)preg_match('/^[0-9]{2}-[0-9]{3}-[^\s\x2D\p{C}]{4}$/uD', $value);
}

function osaTextLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function splitOsaRegistrationName(string $value): array
{
    $value = preg_replace('/\s+/u', ' ', trim($value));
    if ($value === null || $value === '' || osaTextLength($value) > 200) throw new InvalidArgumentException('A full name of 200 characters or fewer is required.');
    $parts = explode(' ', $value);
    $last = count($parts) > 1 ? array_pop($parts) : '-';
    $first = implode(' ', $parts);
    if (osaTextLength($first) > 100 || osaTextLength($last) > 100) throw new InvalidArgumentException('First and last names must each be 100 characters or fewer.');
    return [$first, $last];
}

function osaRequestUserId(mixed $value): int
{
    if ((!is_int($value) && !is_string($value)) || !preg_match('/^[1-9][0-9]*$/D', (string)$value)) return 0;
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    return $id === false ? 0 : $id;
}
