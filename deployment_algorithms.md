# Production-Ready Algorithms & Data Structures (Mapped to AISERS)

## Overview
This document maps essential production-grade algorithms directly to the specific modules of the AISERS project (Officer Dashboard, OSA Dashboard, Student Dashboard, QR-Attendance, IGPRentalSystem). These recommendations replace the current client-side logic with robust server-side implementations suitable for SQL deployment.

## 1. Security & Authentication
**Context**: Login systems across all dashboards and admin panels.

### A. Password Hashing: **Argon2id**
*   **Where to Apply**:
    *   **Officer Dashboard Login**: Protecting officer credentials.
    *   **OSA Dashboard Login**: Securing administrative access.
    *   **Student Database**: Hashing student passwords (if student login is implemented).
*   **Why**: Your current system likely uses plain text or simple hashes. Argon2id resists GPU-cracking attacks better than bcrypt.

### B. Session Management: **Signed JWT (HMAC-SHA256)**
*   **Where to Apply**:
    *   **Across All Dashboards**: Verify identity on every API request (e.g., `GET /api/rentals`) without hitting the database for session checks.
*   **Implementation**:
    *   **Payload**: `{ "user_id": 123, "role": "officer", "org_id": 5 }`.
    *   **Security**: Store in `HttpOnly` cookies to prevent XSS theft from `officerDashboard.js`.

## 2. Database & Data Access
**Context**: Optimizing data retrieval for tables with thousands of records (Students, Rentals, Attendance).

### A. Indexing: **B-Tree**
*   **Where to Apply (SQL Schema)**:
    *   **QR-Attendance**: `students.student_id` and `students.barcode`. Essential for < 100ms scans.
    *   **IGPRentalSystem**: `inventory.barcode`. Ensures instant item lookup during rental checkout.
    *   **Dashboards**: `rentals.status` and `events.date`. Accelerates filtering "Active Rentals" or "Today's Events".
*   **Why**: Without this, scanning a barcode would require checking every single student record (O(n)), causing lag as the database grows.

### B. Pagination: **Cursor-Based Pagination**
*   **Where to Apply**:
    *   **Officer Dashboard**: "Recent Documents" list.
    *   **IGP Rental History**: The `rental-history.html` table.
    *   **Attendance Logs**: The large attendance table in `index.html`.
*   **Why**: The current `slice(0, 10)` or `LIMIT/OFFSET` logic gets slow with large datasets. Cursor-based fetching (`WHERE id < last_seen_id LIMIT 10`) keeps the UI snappy regardless of data size.

## 3. Business Logic Algorithms
**Context**: Handling specific AISERS workflows correctly.

### A. Concurrency Control: **Optimistic Locking (Versioning)**
*   **Where to Apply**:
    *   **IGPRentalSystem**: Preventing double-booking. If two officers scan "Shoe Cover #1" at the exact same second:
        1.  Both read `status='available', version=1`.
        2.  First one writes `status='rented', version=2`.
        3.  Second one fails because `version` is now 2, not 1. UI shows: "Item was just rented by another officer."

### B. Pricing Logic: **Duration-Based Calculation**
*   **Where to Apply**:
    *   **IGPRentalSystem**: `handleRental()` and payment logic.
*   **Algorithm**:
    *   `RentalDuration = (ReturnTime - RentTime) in Hours`.
    *   `Cost = Ceiling(RentalDuration) * HourlyRate`.
    *   **Constraint**: Add a grace period (e.g., 15 mins) logic on the backend to avoid complaints about 1-minute overages.

### C. Reporting: **Sort-Merge Join**
*   **Where to Apply**:
    *   **Financial Summary**: Generating the "Total Profit" report by joining `Rentals` (money) with `Officers` (who processed it) and `Students` (who paid).
*   **Why**: Most efficient way for SQL to combine these large datasets for monthly reports.

## 4. Synchronization (Offline-First) Strategy
**Context**: `offline-queue-service.js` in IGPRentalSystem and QR-Attendance.

### A. Conflict Resolution: **Last-Write-Wins (LWW)**
*   **Where to Apply**:
    *   **Inventory Status**: If an admin updates an item's status to "Repair" online, but an offline officer marks it "Rented".
    *   **Logic**: The `modified_at` timestamp determines the winner. This is simple and effective for inventory tracking.

### B. Retry Strategy: **Exponential Backoff**
*   **Where to Apply**:
    *   **OfflineQueueService**: When syncing queued rentals/attendance scans back to the SQL database.
    *   **Logic**: If the API is unreachable (e.g. server restart), wait 1s, then 2s, then 4s... instead of retrying every 10ms. This prevents crashing the server when it comes back online.
