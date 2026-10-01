-- Persist the requested locker duration independently of mutable pricing.
-- This changes the existing rentals table only; it does not create a table.
ALTER TABLE rentals
    ADD COLUMN IF NOT EXISTS locker_period_quantity SMALLINT UNSIGNED NULL DEFAULT NULL
    AFTER locker_period_type;
