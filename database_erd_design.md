# AISERS Database Entity Relationship Diagram (ERD)

## Database Design Overview
This ERD is designed for a production-ready relational database (MySQL/PostgreSQL) supporting the AISERS system with five core modules: User Management, Organization Management, Document Workflow, IGP Rental System, and QR-Attendance System.

**Normalization Level**: 3rd Normal Form (3NF)  
**Security**: Argon2id password hashing, JWT session tokens  
**Concurrency**: Optimistic locking via version fields  
**Audit Trail**: All tables include created_at and updated_at timestamps

---

## Table Definitions

### 1. users
Stores core identity and authentication data for all system users (students, officers, OSA staff).

**Note**: Students (including those who serve as officers) use `student_number`. OSA staff (employees) use `employee_number`.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **user_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| student_number | VARCHAR(20) | NULL, INDEXED (UNIQUE filtered) | Official student ID (e.g., "2023-10523") - for students only |
| employee_number | VARCHAR(20) | NULL, INDEXED (UNIQUE filtered) | Employee ID (e.g., "EMP-2024-001") - for OSA staff only |
| email | VARCHAR(255) | UNIQUE, NOT NULL | University email |
| password_hash | VARCHAR(255) | NOT NULL | Argon2id hashed password |
| first_name | VARCHAR(100) | NOT NULL | Given name |
| last_name | VARCHAR(100) | NOT NULL | Surname |
| role | ENUM('student', 'osa_staff') | NOT NULL, DEFAULT 'student' | System-wide role |
| course | VARCHAR(50) | NULL | Academic program (e.g., "BS-IT", "BS-Aeronautics") - students only |
| year_level | INT | NULL, CHECK (1-5) | Year level (1-5) - students only |
| section | VARCHAR(20) | NULL | Section designation (e.g., "A", "1-1", "Bravo") - students only |
| barcode | VARCHAR(50) | UNIQUE, INDEXED | Code 128 barcode for scanning (STU* for students, EMP* for staff) |
| has_unpaid_debt | BOOLEAN | DEFAULT FALSE | Blocks rentals if TRUE (applies to students only) |
| is_active | BOOLEAN | DEFAULT TRUE | Account status |
| last_login_at | TIMESTAMP | NULL | Last authentication timestamp |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Business Rule Constraint**: Students must have `student_number` (and `employee_number` must be NULL). OSA staff must have `employee_number` (and `student_number` must be NULL).

**Indexes**:
- UNIQUE filtered B-Tree on `student_number` (for fast lookup during login and scanning, non-NULL only)
- UNIQUE filtered B-Tree on `employee_number` (for OSA staff lookup, non-NULL only)
- B-Tree on `barcode` (for QR/barcode scanning in attendance and rentals)
- B-Tree on `email` (for authentication)
- Composite on `(course, year_level, section)` (for attendance filtering and reports)

---

### 2. organizations
Student organizations registered in the system.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **org_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| org_name | VARCHAR(255) | UNIQUE, NOT NULL | Official organization name |
| org_code | VARCHAR(20) | UNIQUE, NOT NULL | Short code (e.g., "ACMUP") |
| description | TEXT | NULL | Mission statement or about text |
| logo_url | VARCHAR(500) | NULL | Path to organization logo |
| status | ENUM('active', 'probation', 'suspended') | DEFAULT 'active' | Accreditation status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Registration date |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Indexes**:
- B-Tree on `org_code` (for quick filtering in dashboards)

---

### 3. organization_members
Junction table linking users to organizations with role specification.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **membership_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| user_id | INT | FK → users.user_id, NOT NULL, INDEXED | Member reference |
| org_id | INT | FK → organizations.org_id, NOT NULL, INDEXED | Organization reference |
| role | ENUM('member', 'officer', 'president', 'treasurer', 'secretary') | DEFAULT 'member' | Membership role |
| joined_at | DATE | NOT NULL | Membership start date |
| is_active | BOOLEAN | DEFAULT TRUE | Active membership status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Unique Constraint**: (user_id, org_id) - A user can only have one membership record per organization  
**Indexes**:
- Composite index on (user_id, org_id, role) for permission checks
- B-Tree on `org_id` (for listing all members of an organization)

---

### 4. documents
Document submissions from organizations (proposals, reports, financial statements).

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **document_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| org_id | INT | FK → organizations.org_id, NOT NULL, INDEXED | Submitting organization |
| submitted_by | INT | FK → users.user_id, NOT NULL | Officer who uploaded |
| title | VARCHAR(255) | NOT NULL | Document name |
| document_type | ENUM('proposal', 'activity_report', 'financial_statement', 'resolution', 'other') | NOT NULL | Category |
| file_path | VARCHAR(500) | NOT NULL | Storage location (e.g., "/docs/org5/report_2026.pdf") |
| file_size | INT | NOT NULL | Size in bytes |
| status | ENUM('pending', 'ssc_review', 'osa_review', 'approved', 'rejected') | DEFAULT 'pending', INDEXED | Approval workflow state |
| reviewed_by | INT | FK → users.user_id, NULL | OSA staff who reviewed |
| review_notes | TEXT | NULL | Feedback or rejection reason |
| reviewed_at | TIMESTAMP | NULL | Review completion timestamp |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Submission date |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Indexes**:
- Composite index on (org_id, status) for filtering pending documents
- B-Tree on `status` (for OSA dashboard approval queue)

---

### 5. events
Events created by organizations for attendance tracking.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **event_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| org_id | INT | FK → organizations.org_id, NOT NULL, INDEXED | Hosting organization |
| created_by | INT | FK → users.user_id, NOT NULL | Officer who created event |
| event_name | VARCHAR(255) | NOT NULL | Event title |
| description | TEXT | NULL | Event details |
| location | VARCHAR(255) | NOT NULL | Venue |
| event_date | DATE | NOT NULL, INDEXED | Scheduled date |
| start_time | TIME | NOT NULL | Begin time |
| end_time | TIME | NOT NULL | End time |
| event_type | ENUM('meeting', 'seminar', 'workshop', 'competition', 'social', 'other') | DEFAULT 'other' | Category |
| qr_code_url | VARCHAR(500) | NULL | Generated QR code for check-in |
| is_published | BOOLEAN | DEFAULT FALSE | Visible in student feed |
| max_participants | INT | NULL | Capacity limit (NULL = unlimited) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Indexes**:
- Composite index on (event_date, is_published) for student dashboard feed
- B-Tree on `org_id` (for filtering events by organization)

---

### 6. attendance_logs
Records student attendance at events (time-in/time-out).

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **attendance_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| event_id | INT | FK → events.event_id, NOT NULL, INDEXED | Event reference |
| user_id | INT | FK → users.user_id, NOT NULL, INDEXED | Attendee reference |
| time_in | TIMESTAMP | NOT NULL | Check-in timestamp |
| time_out | TIMESTAMP | NULL | Check-out timestamp |
| duration_minutes | INT | GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, time_in, time_out)) | Computed field (NULL when time_out is NULL) |
| scan_method | ENUM('qr_code', 'barcode', 'manual') | DEFAULT 'qr_code' | Entry method |
| is_synced | BOOLEAN | DEFAULT FALSE | Offline sync status |
| modified_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | For conflict resolution (LWW) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Log creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Unique Constraint**: (event_id, user_id) - One attendance record per student per event  
**Indexes**:
- Composite index on (event_id, user_id) for duplicate prevention
- B-Tree on `is_synced` (for offline queue processing)

**Note**: `duration_minutes` will be NULL when `time_out` is NULL (student still checked in). Application frontend should handle NULL gracefully for active attendance records.

---

### 7. inventory_items
Equipment and uniforms available for rental.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **item_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| org_id | INT | FK → organizations.org_id, NOT NULL, INDEXED | Owning organization |
| item_name | VARCHAR(255) | NOT NULL | Item description (e.g., "Shoe Cover Size L") |
| barcode | VARCHAR(50) | UNIQUE, NOT NULL, INDEXED | Code 128 barcode |
| category | ENUM('uniform', 'equipment', 'sports_gear', 'electronics', 'other') | NOT NULL | Item type |
| stock_quantity | INT | NOT NULL, DEFAULT 1 | Total units available |
| available_quantity | INT | NOT NULL, DEFAULT 1 | Currently available units |
| hourly_rate | DECIMAL(10, 2) | NOT NULL | Rental cost per hour |
| status | ENUM('available', 'rented', 'maintenance', 'retired') | DEFAULT 'available', INDEXED | Item availability |
| version | INT | DEFAULT 1 | Optimistic locking version |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Check Constraint**: `available_quantity <= stock_quantity`  
**Indexes**:
- B-Tree on `barcode` (for fast scanning during checkout)
- Composite index on (org_id, status) for inventory dashboard

---

### 8. rentals
Rental transactions linking students to equipment.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **rental_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| user_id | INT | FK → users.user_id, NOT NULL, INDEXED | Renter reference |
| processed_by | INT | FK → users.user_id, NOT NULL | Officer who processed |
| rent_time | TIMESTAMP | NOT NULL | Checkout timestamp |
| expected_return_time | TIMESTAMP | NOT NULL | Due date/time |
| actual_return_time | TIMESTAMP | NULL | Actual return timestamp |
| total_cost | DECIMAL(10, 2) | DEFAULT 0.00 | Calculated rental fee |
| payment_status | ENUM('unpaid', 'paid', 'waived') | DEFAULT 'unpaid', INDEXED | Payment state |
| payment_method | ENUM('cash', 'gcash', 'bank_transfer', 'free') | NULL | How payment was made |
| paid_at | TIMESTAMP | NULL | Payment timestamp |
| status | ENUM('active', 'returned', 'overdue', 'cancelled') | DEFAULT 'active', INDEXED | Rental state |
| notes | TEXT | NULL | Special instructions or comments |
| version | INT | DEFAULT 1 | Optimistic locking version |
| is_synced | BOOLEAN | DEFAULT FALSE | Offline sync status |
| modified_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | For conflict resolution (LWW) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Transaction date |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Indexes**:
- Composite index on (user_id, payment_status) for debt checking
- Composite index on (status, expected_return_time) for overdue tracking
- B-Tree on `is_synced` (for offline queue)

---

### 9. rental_items
Junction table linking rentals to specific inventory items (supports multi-item rentals).

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **rental_item_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| rental_id | INT | FK → rentals.rental_id, NOT NULL, INDEXED | Rental transaction reference |
| item_id | INT | FK → inventory_items.item_id, NOT NULL, INDEXED | Inventory item reference |
| quantity | INT | NOT NULL, DEFAULT 1 | Number of units rented |
| unit_rate | DECIMAL(10, 2) | NOT NULL | Hourly rate at time of rental |
| item_cost | DECIMAL(10, 2) | NOT NULL | Cost for this item (quantity × duration × rate) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Unique Constraint**: (rental_id, item_id) - Each item appears once per rental  
**Indexes**:
- Composite index on (rental_id, item_id) for transaction lookups

---

### 10. announcements
Posts created by organizations, optionally linked to events.

| Column | Data Type | Constraints | Description |
|--------|-----------|-------------|-------------|
| **announcement_id** | INT | PK, AUTO_INCREMENT | Primary identifier |
| org_id | INT | FK → organizations.org_id, NOT NULL, INDEXED | Posting organization |
| created_by | INT | FK → users.user_id, NOT NULL | Officer who posted |
| event_id | INT | FK → events.event_id, NULL, INDEXED | Optional event link |
| title | VARCHAR(255) | NOT NULL | Announcement headline |
| content | TEXT | NOT NULL | Full message body |
| audience_type | ENUM('all_students', 'members_only', 'officers_only') | DEFAULT 'all_students' | Target audience |
| priority | ENUM('low', 'normal', 'high', 'urgent') | DEFAULT 'normal' | Display priority |
| is_published | BOOLEAN | DEFAULT FALSE | Visibility status |
| published_at | TIMESTAMP | NULL | Publication timestamp |
| expires_at | TIMESTAMP | NULL | Optional expiration date |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Indexes**:
- Composite index on (org_id, is_published, published_at) for feed generation
- B-Tree on `event_id` (for event-related announcements)

---

## Entity Relationships

### Cardinality Legend
- **1:1** = One-to-One
- **1:N** = One-to-Many
- **M:N** = Many-to-Many (via junction table)

### Core User & Organization Relationships

```
users (1) ────< (N) organization_members
    Purpose: A user can be a member of multiple organizations
    FK: organization_members.user_id → users.user_id
    Cascade: ON DELETE CASCADE (remove memberships if user deleted)

organizations (1) ────< (N) organization_members
    Purpose: An organization has multiple members
    FK: organization_members.org_id → organizations.org_id
    Cascade: ON DELETE CASCADE (remove memberships if org dissolved)

RESULT: users (M) ────< organization_members >────< (N) organizations
    A Many-to-Many relationship between users and organizations, 
    with role attributes stored in the junction table.
```

### Document Management Relationships

```
organizations (1) ────< (N) documents
    Purpose: An organization submits multiple documents
    FK: documents.org_id → organizations.org_id
    Cascade: ON DELETE RESTRICT (prevent org deletion if documents exist)

users (1) ────< (N) documents [as submitted_by]
    Purpose: An officer uploads multiple documents
    FK: documents.submitted_by → users.user_id
    Cascade: ON DELETE RESTRICT (preserve audit trail)

users (1) ────< (N) documents [as reviewed_by]
    Purpose: An OSA staff member reviews multiple documents
    FK: documents.reviewed_by → users.user_id
    Cascade: ON DELETE SET NULL (preserve document if reviewer account deleted)
```

### Event & Attendance Relationships

```
organizations (1) ────< (N) events
    Purpose: An organization hosts multiple events
    FK: events.org_id → organizations.org_id
    Cascade: ON DELETE CASCADE (remove events if org dissolved)

users (1) ────< (N) events [as created_by]
    Purpose: An officer creates multiple events
    FK: events.created_by → users.user_id
    Cascade: ON DELETE RESTRICT (preserve event records)

events (1) ────< (N) attendance_logs
    Purpose: An event has multiple attendance records
    FK: attendance_logs.event_id → events.event_id
    Cascade: ON DELETE CASCADE (remove logs if event deleted)

users (1) ────< (N) attendance_logs
    Purpose: A user attends multiple events
    FK: attendance_logs.user_id → users.user_id
    Cascade: ON DELETE CASCADE (remove logs if user deleted)

RESULT: users (M) ────< attendance_logs >────< (N) events
    A Many-to-Many relationship tracking which users attended which events.
```

### Announcement Relationships

```
organizations (1) ────< (N) announcements
    Purpose: An organization posts multiple announcements
    FK: announcements.org_id → organizations.org_id
    Cascade: ON DELETE CASCADE (remove announcements if org dissolved)

users (1) ────< (N) announcements [as created_by]
    Purpose: An officer creates multiple announcements
    FK: announcements.created_by → users.user_id
    Cascade: ON DELETE RESTRICT (preserve announcement records)

events (1) ────< (N) announcements
    Purpose: An event may have multiple related announcements
    FK: announcements.event_id → events.event_id
    Cascade: ON DELETE SET NULL (preserve announcement if event deleted)
```

### Rental System Relationships

```
organizations (1) ────< (N) inventory_items
    Purpose: An organization owns multiple equipment items
    FK: inventory_items.org_id → organizations.org_id
    Cascade: ON DELETE RESTRICT (prevent deletion if inventory exists)

users (1) ────< (N) rentals [as user_id]
    Purpose: A student has multiple rental transactions
    FK: rentals.user_id → users.user_id
    Cascade: ON DELETE RESTRICT (preserve financial records)

users (1) ────< (N) rentals [as processed_by]
    Purpose: An officer processes multiple rentals
    FK: rentals.processed_by → users.user_id
    Cascade: ON DELETE RESTRICT (preserve transaction audit trail)

rentals (1) ────< (N) rental_items
    Purpose: A rental transaction contains multiple items
    FK: rental_items.rental_id → rentals.rental_id
    Cascade: ON DELETE CASCADE (remove line items if transaction deleted)

inventory_items (1) ────< (N) rental_items
    Purpose: An inventory item appears in multiple rental transactions
    FK: rental_items.item_id → inventory_items.item_id
    Cascade: ON DELETE RESTRICT (prevent deletion of items with rental history)

RESULT: rentals (M) ────< rental_items >────< (N) inventory_items
    A Many-to-Many relationship enabling multi-item rentals 
    with quantity and cost stored in the junction table.
```

---

## Comprehensive Relationship Diagram

```
┌─────────┐
│  users  │──────────────────────────┐
└────┬────┘                          │
     │ 1                             │ 1
     │                               │
     │ N                             │ N
┌────┴─────────────────┐      ┌─────┴─────────┐
│ organization_members │      │   documents   │
└────┬─────────────────┘      │  (submitted)  │
     │ N                      └───────────────┘
     │
     │ 1
┌────┴──────────┐       1:N         1:N
│ organizations │───────>───┐    ┌───<─────┐
└───────────────┘            │    │         │
     │ 1                     │    │         │
     ├───────> inventory_items    │    documents
     │           │ 1               │   (reviewed)
     │           │ N               │
     │           │              ┌──┴──┐
     │      rental_items        │users│
     │           │ N            └─────┘
     │           │ 1               │ 1
     │       ┌───┴────┐            │
     │       │rentals │<───────────┘ N
     │       └────────┘           (processed_by)
     │           │ N
     │           │ 1
     │       ┌───┴───┐
     │       │ users │
     │       └───────┘
     │
     ├───────> events
     │           │ 1
     │           ├───> announcements (optional link)
     │           │ N
     │           │
     │           │ 1
     │           │
     │       attendance_logs
     │           │ N
     │           │ 1
     │       ┌───┴───┐
     │       │ users │
     │       └───────┘
     │
     └───────> announcements
                 │ 1
                 │ N
             ┌───┴───┐
             │ users │
             │(created_by)
             └───────┘
```

---

## Implementation Notes

### 1. Indexing Strategy (Based on Query Patterns)

**Critical B-Tree Indexes** (As per `deployment_algorithms.md`):
- `users.student_number` - O(log N) student login lookup
- `users.employee_number` - O(log N) OSA staff login lookup
- `users.barcode` - O(log N) scanning in attendance/rentals
- `inventory_items.barcode` - O(log N) item checkout
- `rentals.status` - Filter active/overdue rentals
- `events.event_date` - Sort upcoming events
- `attendance_logs.is_synced` - Process offline queue

**Composite Indexes** (For Multi-Column Queries):
- `(org_id, status)` on documents - OSA approval queue
- `(user_id, payment_status)` on rentals - Debt check before rental
- `(event_date, is_published)` on events - Student dashboard feed

### 2. Data Integrity Rules

**Prevent Double-Booking** (IGP Rental System):
```sql
-- Optimistic Locking Example (pseudo-code)
UPDATE inventory_items 
SET available_quantity = available_quantity - 1, 
    version = version + 1
WHERE item_id = 5 
  AND version = 3 
  AND available_quantity >= 1;

-- If 0 rows affected, someone else rented it first
```

**Debt Blocking** (Business Logic):
```sql
-- Before creating a rental, check:
SELECT has_unpaid_debt FROM users WHERE user_id = 123;

-- If TRUE, reject rental request
```

**Duplicate Attendance Prevention**:
```sql
-- Unique constraint on (event_id, user_id) enforces this at DB level
```

### 3. Offline Synchronization Strategy

**Last-Write-Wins (LWW) Conflict Resolution**:
- Use `modified_at` timestamp on `rentals` and `attendance_logs`
- When offline device syncs, compare local vs. server `modified_at`
- Keep the record with the latest timestamp

**Sync Queue Processing**:
```sql
-- Fetch unsynced records
SELECT * FROM attendance_logs 
WHERE is_synced = FALSE 
ORDER BY modified_at ASC 
LIMIT 100;

-- After successful API upload, mark synced
UPDATE attendance_logs SET is_synced = TRUE WHERE attendance_id IN (...);
```

### 4. Pagination Implementation

**Cursor-Based (for Rental History)**:
```sql
-- Initial request
SELECT * FROM rentals 
WHERE org_id = 5 
ORDER BY rental_id DESC 
LIMIT 20;

-- Next page (where last rental_id = 1523)
SELECT * FROM rentals 
WHERE org_id = 5 AND rental_id < 1523 
ORDER BY rental_id DESC 
LIMIT 20;
```

### 5. Pricing Calculation (IGP Rentals)

**Duration-Based Cost**:
```sql
-- Computed when rental is returned
UPDATE rentals 
SET actual_return_time = NOW(),
    total_cost = (
        SELECT SUM(
            rental_items.quantity * 
            rental_items.unit_rate * 
            CEILING(TIMESTAMPDIFF(HOUR, rentals.rent_time, NOW()))
        )
        FROM rental_items 
        WHERE rental_items.rental_id = rentals.rental_id
    )
WHERE rental_id = 42;
```

**Grace Period Logic** (Application Layer):
```javascript
const rentalDuration = (returnTime - rentTime) / 3600000; // hours
const gracePeriod = 15 / 60; // 15 minutes in hours
const billableDuration = Math.max(0, rentalDuration - gracePeriod);
const cost = Math.ceil(billableDuration) * hourlyRate;
```

### 6. Query Optimization Examples

**Officer Dashboard - Recent Documents**:
```sql
SELECT d.*, o.org_name 
FROM documents d
INNER JOIN organizations o ON d.org_id = o.org_id
WHERE d.org_id = 5 
  AND d.status = 'pending'
ORDER BY d.created_at DESC 
LIMIT 10;
-- Uses composite index on (org_id, status)
```

**OSA Dashboard - Approval Queue**:
```sql
SELECT d.*, o.org_name, u.first_name, u.last_name
FROM documents d
INNER JOIN organizations o ON d.org_id = o.org_id
INNER JOIN users u ON d.submitted_by = u.user_id
WHERE d.status IN ('pending', 'ssc_review')
ORDER BY d.created_at ASC;
-- Uses B-Tree index on status
```

**Student Dashboard - Upcoming Events**:
```sql
SELECT e.*, o.org_name 
FROM events e
INNER JOIN organizations o ON e.org_id = o.org_id
WHERE e.is_published = TRUE 
  AND e.event_date >= CURDATE()
ORDER BY e.event_date ASC, e.start_time ASC
LIMIT 20;
-- Uses composite index on (event_date, is_published)
```

**Rental History - Active Rentals with Overdue**:
```sql
SELECT r.*, 
       COALESCE(u.student_number, u.employee_number) AS id_number,
       u.first_name
FROM rentals r
INNER JOIN users u ON r.user_id = u.user_id
WHERE r.status = 'active' 
  AND r.expected_return_time < NOW()
ORDER BY r.expected_return_time ASC;
-- Uses composite index on (status, expected_return_time)
```

### 7. Security & Authentication

**Password Storage** (Application Layer):
```javascript
// On registration/password change
const passwordHash = await argon2.hash(plainPassword, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4
});

// Store passwordHash in users.password_hash
```

**Session Management** (JWT):
```javascript
// On successful login
const token = jwt.sign(
  { 
    user_id: 123, 
    role: 'officer', 
    org_id: 5 
  },
  process.env.JWT_SECRET,
  { expiresIn: '8h', algorithm: 'HS256' }
);

// Set as HttpOnly cookie
res.cookie('session_token', token, { 
  httpOnly: true, 
  secure: true, 
  sameSite: 'strict' 
});
```

---

## Database Creation Scripts

### MySQL/MariaDB Example

```sql
-- Create Database
CREATE DATABASE aisers_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aisers_db;

-- Users Table
-- Note: Students use student_number, OSA staff use employee_number
-- Uniqueness for nullable columns is enforced via filtered unique indexes
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    student_number VARCHAR(20) NULL,  -- For students only
    employee_number VARCHAR(20) NULL,  -- For OSA staff only
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('student', 'osa_staff') NOT NULL DEFAULT 'student',
    -- Academic details (students only)
    course VARCHAR(50) NULL,          -- e.g., 'BS-IT', 'BS-Aeronautics'
    year_level INT NULL CHECK (year_level BETWEEN 1 AND 5),
    section VARCHAR(20) NULL,         -- e.g., 'A', '1-1', 'Bravo'
    barcode VARCHAR(50) UNIQUE,
    has_unpaid_debt BOOLEAN DEFAULT FALSE,  -- Applies to students only
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_number (student_number),
    INDEX idx_employee_number (employee_number),
    INDEX idx_barcode (barcode),
    INDEX idx_email (email),
    INDEX idx_course_year_section (course, year_level, section),
    -- Ensure role-appropriate ID is populated
    CONSTRAINT chk_user_id_type CHECK (
        (role = 'student' AND student_number IS NOT NULL AND employee_number IS NULL) OR
        (role = 'osa_staff' AND employee_number IS NOT NULL AND student_number IS NULL)
    )
) ENGINE=InnoDB;

-- Note for SQL Server: Use filtered UNIQUE indexes instead
-- CREATE UNIQUE INDEX idx_student_number ON users(student_number) WHERE student_number IS NOT NULL;
-- CREATE UNIQUE INDEX idx_employee_number ON users(employee_number) WHERE employee_number IS NOT NULL;

-- Organizations Table
CREATE TABLE organizations (
    org_id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(255) UNIQUE NOT NULL,
    org_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    status ENUM('active', 'probation', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_code (org_code)
) ENGINE=InnoDB;

-- Organization Members Table
CREATE TABLE organization_members (
    membership_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    org_id INT NOT NULL,
    role ENUM('member', 'officer', 'president', 'treasurer', 'secretary') DEFAULT 'member',
    joined_at DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_membership (user_id, org_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    INDEX idx_user_org_role (user_id, org_id, role),
    INDEX idx_org_members (org_id)
) ENGINE=InnoDB;

-- Documents Table
CREATE TABLE documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    submitted_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_type ENUM('proposal', 'activity_report', 'financial_statement', 'resolution', 'other') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    status ENUM('pending', 'ssc_review', 'osa_review', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_org_status (org_id, status),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Events Table
CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    event_type ENUM('meeting', 'seminar', 'workshop', 'competition', 'social', 'other') DEFAULT 'other',
    qr_code_url VARCHAR(500),
    is_published BOOLEAN DEFAULT FALSE,
    max_participants INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_event_date_published (event_date, is_published),
    INDEX idx_org_events (org_id)
) ENGINE=InnoDB;

-- Attendance Logs Table
CREATE TABLE attendance_logs (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    time_in TIMESTAMP NOT NULL,
    time_out TIMESTAMP NULL,
    duration_minutes INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, time_in, time_out)) STORED,
    scan_method ENUM('qr_code', 'barcode', 'manual') DEFAULT 'qr_code',
    is_synced BOOLEAN DEFAULT FALSE,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_event_user (event_id, user_id),
    INDEX idx_sync_status (is_synced)
) ENGINE=InnoDB;

-- Inventory Items Table
CREATE TABLE inventory_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    category ENUM('uniform', 'equipment', 'sports_gear', 'electronics', 'other') NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 1,
    available_quantity INT NOT NULL DEFAULT 1,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    status ENUM('available', 'rented', 'maintenance', 'retired') DEFAULT 'available',
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT,
    CHECK (available_quantity <= stock_quantity),
    INDEX idx_barcode (barcode),
    INDEX idx_org_status (org_id, status)
) ENGINE=InnoDB;

-- Rentals Table
CREATE TABLE rentals (
    rental_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    processed_by INT NOT NULL,
    rent_time TIMESTAMP NOT NULL,
    expected_return_time TIMESTAMP NOT NULL,
    actual_return_time TIMESTAMP NULL,
    total_cost DECIMAL(10, 2) DEFAULT 0.00,
    payment_status ENUM('unpaid', 'paid', 'waived') DEFAULT 'unpaid',
    payment_method ENUM('cash', 'gcash', 'bank_transfer', 'free') NULL,
    paid_at TIMESTAMP NULL,
    status ENUM('active', 'returned', 'overdue', 'cancelled') DEFAULT 'active',
    notes TEXT,
    version INT DEFAULT 1,
    is_synced BOOLEAN DEFAULT FALSE,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_user_payment (user_id, payment_status),
    INDEX idx_status_due (status, expected_return_time),
    INDEX idx_sync_status (is_synced)
) ENGINE=InnoDB;

-- Rental Items Table
CREATE TABLE rental_items (
    rental_item_id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_rate DECIMAL(10, 2) NOT NULL,
    item_cost DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rental_item (rental_id, item_id),
    FOREIGN KEY (rental_id) REFERENCES rentals(rental_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory_items(item_id) ON DELETE RESTRICT,
    INDEX idx_rental_item (rental_id, item_id)
) ENGINE=InnoDB;

-- Announcements Table
CREATE TABLE announcements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    created_by INT NOT NULL,
    event_id INT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    audience_type ENUM('all_students', 'members_only', 'officers_only') DEFAULT 'all_students',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE SET NULL,
    INDEX idx_org_published (org_id, is_published, published_at),
    INDEX idx_event_announcements (event_id)
) ENGINE=InnoDB;
```

---

## Sample Data Population

```sql
-- Insert Sample Users (Students)
INSERT INTO users (student_number, employee_number, email, password_hash, first_name, last_name, role, course, year_level, section, barcode) VALUES
('2023-10523', NULL, 'juan.delacruz@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$...', 'Juan', 'Dela Cruz', 'student', 'BS-IT', 3, 'A', 'STU-BC202310523'),
('2023-10524', NULL, 'maria.santos@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$...', 'Maria', 'Santos', 'student', 'BS-Aeronautics', 2, '1-1', 'STU-BC202310524'),
('2023-10525', NULL, 'pedro.garcia@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$...', 'Pedro', 'Garcia', 'student', 'BS-IT', 3, 'A', 'STU-BC202310525');

-- Insert OSA Staff (Employees)
INSERT INTO users (student_number, employee_number, email, password_hash, first_name, last_name, role, course, year_level, section, barcode) VALUES
(NULL, 'EMP-2024-001', 'ana.reyes@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$...', 'Ana', 'Reyes', 'osa_staff', NULL, NULL, NULL, 'EMP-BC2024001'),
(NULL, 'EMP-2024-002', 'carlo.mendoza@university.edu.ph', '$argon2id$v=19$m=65536,t=3,p=4$...', 'Carlo', 'Mendoza', 'osa_staff', NULL, NULL, NULL, 'EMP-BC2024002');

-- Insert Sample Organizations
INSERT INTO organizations (org_name, org_code, description, status) VALUES
('Association for Computing Machinery', 'ACM', 'Computing and technology student organization', 'active'),
('Institute of Governance and Public Relations', 'IGP', 'Organization managing events and equipment rentals', 'active');

-- Insert Memberships
INSERT INTO organization_members (user_id, org_id, role, joined_at) VALUES
(1, 1, 'officer', '2023-08-01'),
(2, 1, 'member', '2024-01-15'),
(1, 2, 'member', '2024-02-01');

-- Insert Sample Inventory
INSERT INTO inventory_items (org_id, item_name, barcode, category, stock_quantity, available_quantity, hourly_rate, status) VALUES
(2, 'Shoe Cover Size L', 'ITM001', 'uniform', 10, 9, 5.00, 'available'),
(2, 'Hair Net', 'ITM002', 'uniform', 20, 20, 3.00, 'available'),
(2, 'Projector Sony VPL', 'ITM003', 'electronics', 2, 1, 50.00, 'available');

-- Insert Sample Event
INSERT INTO events (org_id, created_by, event_name, description, location, event_date, start_time, end_time, is_published) VALUES
(1, 1, 'Tech Summit 2026', 'Annual technology conference', 'Engineering Building Auditorium', '2026-03-15', '09:00:00', '17:00:00', TRUE);
```

---

## Migration & Deployment Checklist

- [ ] Set up MySQL/PostgreSQL database server
- [ ] Create database with UTF-8 character encoding
- [ ] Execute table creation scripts in order (users → organizations → junction tables → dependent tables)
- [ ] Create database user with appropriate permissions (SELECT, INSERT, UPDATE, DELETE)
- [ ] Set up automated backups (daily incremental, weekly full)
- [ ] Configure connection pooling (recommended: 10-50 connections based on traffic)
- [ ] Enable slow query logging for performance monitoring
- [ ] Set up monitoring for index usage and query performance
- [ ] Test all foreign key constraints with sample data
- [ ] Verify cascade behaviors (especially for DELETE operations)
- [ ] Load initial data (OSA staff accounts, default organizations)
- [ ] Create database documentation in team wiki
- [ ] Set up staging environment replica for testing
- [ ] Plan migration path for legacy data (if transitioning from existing system)

---

## Future Enhancements

### Phase 2 Considerations
1. **Notification System**: Add `notifications` table for push alerts
2. **Audit Logging**: Create `audit_logs` table to track all CRUD operations
3. **File Metadata**: Expand `documents` with version control and thumbnails
4. **Organization Financials**: Add `transactions` table for detailed fund tracking
5. **Event Feedback**: Create `event_surveys` table for post-event evaluations
6. **Advanced Permissions**: Implement role-based access control (RBAC) table
7. **Analytics Materialized Views**: Pre-compute dashboard statistics for faster loading

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Designed By**: AISERS Development Team  
**Target DBMS**: MySQL 8.0+ / MariaDB 10.5+ / PostgreSQL 13+
