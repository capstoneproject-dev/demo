-- MariaDB 10.4+, apply ONCE with matching PHP changes during maintenance.
-- Back up first and STOP application/background writes. Import without --force.
-- DDL auto-commits: on failure keep writes stopped and inspect/restore the
-- partial schema before retrying. No new tables or deletion of business records.
DELIMITER $$
CREATE PROCEDURE capstone_business_constraints_preflight()
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()
        AND engine = 'InnoDB' AND table_name IN ('rentals','rental_items','inventory_items','print_jobs')) <> 4 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Required existing tables must use InnoDB';
    END IF;
    IF EXISTS (SELECT renter_user_id FROM rentals WHERE service_kind = 'locker'
        AND status IN ('locker_pending','locker_active','locker_overdue')
        GROUP BY renter_user_id HAVING COUNT(*) > 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duplicate current locker holders: inspect rentals';
    END IF;
    IF EXISTS (SELECT r.rental_id FROM rentals r LEFT JOIN rental_items ri USING (rental_id)
        WHERE r.service_kind = 'locker' GROUP BY r.rental_id
        HAVING COUNT(ri.rental_item_id) <> 1 OR MIN(ri.quantity) <> 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker rentals must each identify exactly one physical locker';
    END IF;
    IF EXISTS (SELECT ri.item_id FROM rental_items ri JOIN rentals r USING (rental_id)
        WHERE r.service_kind = 'locker' AND r.status IN ('locker_pending','locker_active','locker_overdue')
        GROUP BY ri.item_id HAVING COUNT(*) > 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duplicate current locker assignments: inspect rental_items';
    END IF;
    IF EXISTS (SELECT 1 FROM rental_items ri LEFT JOIN rentals r USING (rental_id)
        LEFT JOIN inventory_items i USING (item_id) WHERE r.rental_id IS NULL OR i.item_id IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Orphan rental items: repair explicitly before migration';
    END IF;
    IF EXISTS (SELECT 1 FROM rentals r JOIN rental_items ri USING (rental_id)
        JOIN inventory_items i USING (item_id) WHERE r.service_kind = 'locker' AND r.org_id <> i.org_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker rental and inventory organizations do not match';
    END IF;
    IF EXISTS (SELECT 1 FROM rentals WHERE status IN ('locker_pending','locker_active','locker_overdue') AND service_kind <> 'locker') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker statuses require locker service_kind';
    END IF;
    IF EXISTS (SELECT org_id, queue_order FROM print_jobs WHERE status = 'queued'
        GROUP BY org_id, queue_order HAVING COUNT(*) > 1)
        OR EXISTS (SELECT 1 FROM print_jobs WHERE queue_order < 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid or duplicate queue positions: inspect print_jobs';
    END IF;
END$$
DELIMITER ;
CALL capstone_business_constraints_preflight();
DROP PROCEDURE capstone_business_constraints_preflight;

-- Keep locker identity with its state: uniqueness is enforced on a single row.
ALTER TABLE inventory_items ADD UNIQUE KEY uq_inventory_org_item (org_id, item_id);
ALTER TABLE rentals ADD COLUMN locker_item_id INT NULL DEFAULT NULL;
UPDATE rentals r JOIN rental_items ri USING (rental_id)
SET r.locker_item_id = ri.item_id WHERE r.service_kind = 'locker';
-- The existing updated-at trigger timestamps backfilled locker rows. Original
-- dates, prices, payments and rental-item history are preserved.
ALTER TABLE rentals
    ADD COLUMN current_locker_student INT GENERATED ALWAYS AS
        (CASE WHEN service_kind = 'locker' AND status IN ('locker_pending','locker_active','locker_overdue')
              THEN renter_user_id ELSE NULL END) PERSISTENT,
    ADD COLUMN current_locker_item INT GENERATED ALWAYS AS
        (CASE WHEN service_kind = 'locker' AND status IN ('locker_pending','locker_active','locker_overdue')
              THEN locker_item_id ELSE NULL END) PERSISTENT,
    ADD UNIQUE KEY uq_current_locker_student (current_locker_student),
    ADD UNIQUE KEY uq_current_locker_item (current_locker_item),
    ADD KEY idx_rentals_student_service_status (renter_user_id, service_kind, status),
    ADD CONSTRAINT fk_locker_identity FOREIGN KEY (org_id, locker_item_id) REFERENCES inventory_items(org_id, item_id),
    ADD CONSTRAINT chk_current_locker_identity CHECK
        (status NOT IN ('locker_pending','locker_active','locker_overdue')
         OR (service_kind = 'locker' AND locker_item_id IS NOT NULL));

-- Original rental-item foreign keys are missing in some installations.
SET @claim_fk_sql = IF(EXISTS (SELECT 1 FROM information_schema.key_column_usage
    WHERE constraint_schema = DATABASE() AND table_name = 'rental_items'
      AND column_name = 'rental_id' AND referenced_table_name = 'rentals' AND referenced_column_name = 'rental_id'),
    'SELECT 1', 'ALTER TABLE rental_items ADD CONSTRAINT fk_claim_rental FOREIGN KEY (rental_id) REFERENCES rentals(rental_id) ON DELETE CASCADE');
PREPARE claim_fk_stmt FROM @claim_fk_sql;
EXECUTE claim_fk_stmt;
DEALLOCATE PREPARE claim_fk_stmt;
SET @claim_fk_sql = IF(EXISTS (SELECT 1 FROM information_schema.key_column_usage
    WHERE constraint_schema = DATABASE() AND table_name = 'rental_items'
      AND column_name = 'item_id' AND referenced_table_name = 'inventory_items' AND referenced_column_name = 'item_id'),
    'SELECT 1', 'ALTER TABLE rental_items ADD CONSTRAINT fk_claim_inventory FOREIGN KEY (item_id) REFERENCES inventory_items(item_id)');
PREPARE claim_fk_stmt FROM @claim_fk_sql;
EXECUTE claim_fk_stmt;
DEALLOCATE PREPARE claim_fk_stmt;

DELIMITER $$
CREATE TRIGGER trg_locker_identity_update BEFORE UPDATE ON rentals FOR EACH ROW
BEGIN
    IF (OLD.service_kind = 'locker' OR NEW.service_kind = 'locker') AND
       (OLD.service_kind <> NEW.service_kind OR NOT (OLD.locker_item_id <=> NEW.locker_item_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker rental identity is immutable; release and create a new assignment';
    END IF;
END$$
CREATE TRIGGER trg_locker_item_insert BEFORE INSERT ON rental_items FOR EACH ROW
BEGIN
    DECLARE parent_service VARCHAR(20);
    DECLARE parent_item INT;
    SELECT service_kind, locker_item_id INTO parent_service, parent_item
        FROM rentals WHERE rental_id = NEW.rental_id FOR UPDATE;
    IF parent_service = 'locker' AND (parent_item IS NULL OR parent_item <> NEW.item_id OR NEW.quantity <> 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker rental item must match its single canonical locker';
    END IF;
END$$
CREATE TRIGGER trg_locker_item_update BEFORE UPDATE ON rental_items FOR EACH ROW
BEGIN
    DECLARE parent_service VARCHAR(20);
    DECLARE parent_item INT;
    IF OLD.rental_id <> NEW.rental_id THEN
        SELECT service_kind INTO parent_service FROM rentals WHERE rental_id = OLD.rental_id FOR UPDATE;
        IF parent_service = 'locker' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker rental item cannot move to another rental';
        END IF;
    END IF;
    SELECT service_kind, locker_item_id INTO parent_service, parent_item
        FROM rentals WHERE rental_id = NEW.rental_id FOR UPDATE;
    IF parent_service = 'locker' AND (parent_item IS NULL OR parent_item <> NEW.item_id OR NEW.quantity <> 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Locker rental item must match its single canonical locker';
    END IF;
END$$
CREATE TRIGGER trg_locker_item_delete BEFORE DELETE ON rental_items FOR EACH ROW
BEGIN
    DECLARE parent_service VARCHAR(20);
    DECLARE parent_status VARCHAR(20);
    SELECT service_kind, status INTO parent_service, parent_status
        FROM rentals WHERE rental_id = OLD.rental_id FOR UPDATE;
    IF parent_service = 'locker' AND parent_status IN ('locker_pending','locker_active','locker_overdue') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Release or reject the current locker assignment before removing its item';
    END IF;
END$$
DELIMITER ;

-- Each organization keeps its own queue starting at 1. BIGINT allows unused
-- positive staging positions during reordering; nonqueued history is exempt.
ALTER TABLE print_jobs
    MODIFY COLUMN queue_order BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN current_queue_order BIGINT GENERATED ALWAYS AS
        (CASE WHEN status = 'queued' THEN queue_order ELSE NULL END) PERSISTENT,
    ADD UNIQUE KEY uq_print_current_queue (org_id, current_queue_order),
    ADD CONSTRAINT chk_print_positive_queue CHECK (queue_order >= 1);
