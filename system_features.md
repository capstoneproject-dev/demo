# System Feature List (Production Ready)

## Overview
This document outlines the complete feature set of the AISERS project as it stands for deployment. The system is divided into five core modules.

## 1. Officer Dashboard (Organization Management)
The command center for student organization officers to manage their operations.

### **Core Management**
*   **Analytics Dashboard**: Visual charts for Financial Performance, Participation Trends, and Inventory Utilization.
*   **Announcement System**: Create and post announcements to specific audiences (All Students, Members Only, Officers).
*   **Event Integration**: Option to automatically create a calendar event when posting an announcement.
*   **Quick Actions**: Shortcuts for common tasks (Post Announcement, View Events, Tracker, Documents).

### **Document Workflow**
*   **Repository**: Centralized storage for all organizational documents (Proposals, Reports, Resolutions).
*   **Submission Portal**: Upload PDFs and categorize them (Activity Report, Financial Statement, etc.).
*   **Status Tracking**: Track approval status (Pending, SSC Review, OSA Review, Approved/Rejected).
*   **PDF Viewer**: Integrated viewer with annotation tools (Highlight, Comment) and zoom controls.

### **Services & Tools**
*   **Service Tracker**: Embedded view of the IGP Rental System for managing equipment.
*   **Events Calendar**: Embedded view of the QR Attendance System for managing event participation.

## 2. OSA Dashboard (Office of Student Affairs)
The administrative portal for university staff to oversee student organizations.

### **Organization Oversight**
*   **Accreditation Monitoring**: Track status of all student organizations (Good Standing, Probation).
*   **Financial Auditing**: View summary of organization funds, last audit status, and pending dues.
*   **Sanctioning**: Issue warnings or sanctions to organizations for non-compliance.

### **Request Management**
*   **Approval System**: Review and Approve/Reject Event Proposals, Postings, and Document Submissions.
*   **Filtering**: Sort requests by Type, Organization, Status, or Date Range.
*   **Bulk Actions**: Efficiently handle multiple requests (implied future feature, currently single-action).

### **Document Workflow**
*   **Repository**: Centralized storage for all organizational documents (Proposals, Reports, Resolutions).
*   **Submission Portal**: Upload PDFs and categorize them (Activity Report, Financial Statement, etc.).
*   **Status Tracking**: Track approval status (Pending, SSC Review, OSA Review, Approved/Rejected).
*   **PDF Viewer**: Integrated viewer with annotation tools (Highlight, Comment) and zoom controls.

### **Student Verification**
*   **Enrollment Check**: Verify a student's enrollment status via ID Number or Name (connects to Registrar DB).

## 3. Student Dashboard
The student-facing portal for engagement and information.

### **Engagement**
*   **Event Feed**: View upcoming events, filtered by Today, Upcoming, and Past.
*   **Calendar**: Interactive monthly calendar showing event schedules.
*   **Search**: Find specific events or announcements by keyword.

## 4. QR-Attendance System
A specialized module for efficient event attendance tracking.

### **attendance Tracking**
*   **Fast Scanning**: Support for Barcode/QR code scanning for rapid entry.
*   **Time-In / Time-Out**: Handles both entry and exit logs to calculate duration.
*   **Duplicate Prevention**: Alerts if a student tries to double-scan.
*   **Offline Mode**: Queues scans locally if internet is lost and syncs when back online.
*   **Export**: Generate Excel reports of attendance logs for documentation using `SheetJS`.

## 5. IGP Rental System
A Point-of-Sale (POS) style system for equipment rentals.

### **Inventory & Rentals**
*   **Catalog**: View available items (Uniforms, Equipment) with real-time stock status.
*   **Cart System**: Add multiple items to a rental transaction.
*   **Barcode Checkout**: Scan items and student IDs for fast processing.
*   **Rental History**: Track active rentals, overdue items, and returned assets.

### **Financials**
*   **Automated Pricing**: Calculates cost based on hourly rates and duration.
*   **Unpaid Blocking**: automatically prevents renting if the student has previous unpaid debts.
*   **Offline Capability**: Full functionality (Rent/Return) even without internet connection.
