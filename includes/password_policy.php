<?php
/** Applies only when choosing a new password; never when verifying an existing one. */
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 12 characters and contain an uppercase letter and a number.';

function passwordMeetsPolicy(string $password): bool
{
    return preg_match('/^.{12,}$/us', $password) === 1
        && preg_match('/[A-Z]/', $password) === 1
        && preg_match('/[0-9]/', $password) === 1;
}
