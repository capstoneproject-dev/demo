# Business constraints migration and verification

Prepared on 2026-10-03 for MariaDB 10.4.32. The migration is tested in a
disposable database; it has **not been applied to the configured source database**.
No new application tables are created.

## Installed protections

- `rentals.locker_item_id` records a locker's identity alongside its status.
  Existing locker identities are copied from `rental_items`. Conditional generated
  columns and unique indexes allow only one pending, active or overdue locker
  assignment per physical locker and per student. Released/rejected history can
  repeat both identifiers. Current assignments cannot omit their locker identity.
- A composite inventory foreign key enforces the canonical locker's organization.
  Triggers preserve that identity and require locker item links to match it with
  quantity one. A current locker link cannot be deleted or moved to another rental.
- Missing original rental-item foreign keys are restored: items must reference
  an existing rental and inventory item. Explicitly deleting a parent rental
  cascades its item links, as specified in the original schema. Inventory with
  rental/locker history is retained; the inventory handler explains the restriction.
- A conditional unique `(org_id, current_queue_order)` index protects **queued**
  printing jobs. Organization A and organization B can both have positions 1, 2,
  3. Nonqueued historical jobs do not occupy current slots. Queue positions must
  be positive. Atomic reorder/normalization uses unused positive temporary positions
  before writing final positions; `BIGINT` provides staging room near the old INT
  limit. Normal allocation still uses the existing maximum of 2,147,483,647.
- `(renter_user_id, service_kind, status)` supports existing locker checks.
  Existing printing queue indexes are retained rather than duplicated.
- Known uniqueness collisions become HTTP 409 responses in locker and printing
  routes and remain compatible with offline conflict receipt handling. Unrelated
  duplicate-key errors are not classified as business conflicts.
- The locker insert and queue writer support the original schema before deployment.

Eight existing full-column unique keys were verified for attendance, offline
operations, document decisions/versions, approved submissions and rental-item
pairs. They were retained. Ordinary online requests without an operation identifier
do not gain generic retry deduplication: legitimate separate printing submissions
are still allowed. Equipment's physical-item claim protection remains in its
existing transactions/locks; this migration does not impose a single-item model
on general equipment rentals or add an equipment status mirror.

## Deployment

1. Back up the database and stop application/background writes.
2. Deploy the matching PHP changes and import
   `migrations/20261003_business_constraints.sql` **once**, using a client that
   understands `DELIMITER`. Do not use `mysql --force`.
3. Verify the new columns, indexes, foreign keys and triggers, then resume writes.

Preflight refuses duplicate current locker students/items, lockers without exactly
one matching quantity-one item, orphan items, organization mismatches, invalid
locker service/status combinations, and duplicate/nonpositive queue positions.
It reports conflicts instead of deleting or merging records. Fixes to conflicting
data require a separate decision. A refused preflight leaves its temporary
`capstone_business_constraints_preflight` procedure: drop that procedure after
resolving the reported data before retrying the file.

DDL auto-commits. The whole file is neither transactional nor rerunnable. If an
error occurs after the first table alteration, keep writes stopped, inspect the
partial schema and restore the backup before retrying. Restore the matching old
PHP code with the backup when rolling back deployment.

The existing rental updated-at trigger timestamps backfilled locker rental rows.
Rental dates, prices, payments and item history are preserved. MariaDB-specific
generated-column/trigger behavior was tested; other database versions are not
certified. No production load or browser HTTP run was performed for this scope.

## Review findings, resolved

Review was limited to the new migration and changed PHP/tests, with unchanged
dependencies inspected only to establish the affected behavior.

| Severity | File(s) | Finding and resolution |
| --- | --- | --- |
| High | `migrations/20261003_business_constraints.sql` | A current assignment could evade a nullable identity index. The status/service/identity CHECK, immutable locker identity, matching-item triggers and organization foreign key close that gap. |
| High | `includes/services_tracker.php` | Reordering directly into occupied positions conflicts with immediate unique enforcement. The queue writer stages all locked jobs in unused positions, validates the complete queue membership, then writes final positions. |
| Medium | Migration | Existing conflicts could make a later ALTER fail after partial installation. Data/engine preflight runs before table changes; maintenance, backup and partial-failure recovery are documented. DDL itself remains nontransactional. |
| Medium | Locker APIs; `includes/igp.php`; tracker conflict classifiers | New uniqueness violations would otherwise produce HTTP 500 or fail offline conflict finalization. Named constraint collisions are classified as conflicts, while unrelated key failures retain normal error handling. |
| Medium | `includes/igp.php` | Restored inventory foreign keys reject deletion of historical inventory. The handler checks history while inventory is locked and returns a clear validation error instead of an unexpected database error. |
| Medium | `includes/services_tracker.php` | New canonical locker writes would break the original schema before migration, and staging could overflow its INT column. The insert detects the installed identity column; boundary staging checks the queue column's supported type. |
| Medium | `tests/concurrency/database-constraints.php` | A failed stale-read check could leave a reader transaction open and block disposable database cleanup. Reader/writer transactions are rolled back and connections released before dropping the copy. |
| Low | `tests/concurrency/printing-queue.php` | Legacy tie fixtures are invalid once uniqueness is installed. The suite tests tie recovery on the original schema and database rejection on the migrated schema; it also checks staging beyond INT. |
| Low | Constraint test harness | Source dispatch bookkeeping can change during verification. The comparison reports that specific data-only change, while still rejecting source schema changes and changes to all original business tables. |

No remaining correctness finding was identified in the final changed lines.
That conclusion is limited to the review and checks below.

## Verification

Run `C:/xampp/php/php.exe tests/concurrency/database-constraints.php`.
Use an unmigrated source or a pre-migration backup as the configured source;
the harness tests installation of this one-time migration. After deployment,
run the individual regression suites against a disposable copy of that database
instead of reimporting the migration.
The CLI-only harness dumps the configured source into a randomly named disposable
database, verifies the copy, applies the migration there, and drops only its own
copy in cleanup. Temporary dump files are removed. It does not apply schema
changes or create fixtures in the source database.

Coverage includes original-schema locker insertion and printing workflows;
preflight refusal before alterations; current locker holder/item uniqueness;
history and overdue behavior; identity/quantity/organization validation;
historical inventory deletion; same-locker and same-student/different-locker
collisions using independent PHP processes; stale transaction reactivation; and
the following six migrated-schema regression suites:

- Database connection and real deadlock/lock-timeout behavior.
- Printing allocation, acceptance, transfers, cancellation and reordering.
- Printing offline conflict/partial receipt handling.
- Equipment rental workflows and collision cases.
- Attendance scan collisions.
- Offline receipt claims, replay and conflict handling.

PHP syntax and diff whitespace checks cover all changed PHP files. The original
33-table source remains outside the mutation path. Original source table schemas
and business data matched the fingerprints; notification dispatch runtime data
changed during some runs and was left untouched. Exact byte-for-byte preservation
of that runtime bookkeeping is not claimed.
