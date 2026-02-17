# Process Flow Diagram (PFD) - AISERS System

## System Overview
The AISERS (Academic Institution Student Engagement and Resource System) is a comprehensive web-based platform for managing student organization operations, event attendance, equipment rentals, and administrative workflows.

## High-Level Process Flow Diagram

```mermaid
flowchart TB
    %% User Actors
    subgraph Users["System Users"]
        Student["Students"]
        Officer["Organization Officers"]
        OSA["OSA Staff"]
    end

    %% Entry Point
    Login["Authentication Portal<br/>Login System"]

    %% Main Dashboards
    subgraph Dashboards["User Interfaces"]
        StudentDash["Student Dashboard<br/>Event Feed & Calendar"]
        OfficerDash["Officer Dashboard<br/>Management Portal"]
        OSADash["OSA Dashboard<br/>Administrative Portal"]
    end

    %% Core Modules
    subgraph CoreModules["Core System Modules"]
        Announcements["Announcement System<br/>Post & Distribute"]
        Events["Event Management<br/>Calendar & Scheduling"]
        Documents["Document Workflow<br/>Submit & Track Status"]
        Analytics["Analytics Engine<br/>Charts & Reports"]
    end

    %% Specialized Systems
    subgraph SpecializedSystems["Specialized Modules"]
        QRAttendance["QR-Attendance System<br/>Scan & Track Attendance"]
        IGPRental["IGP Rental System<br/>POS & Inventory"]
    end

    %% Backend Services
    subgraph Backend["Backend Services"]
        Firebase["Firebase Services<br/>Real-time Database"]
        Storage["Document Storage<br/>PDF Repository"]
        OfflineQueue["Offline Queue Service<br/>Sync Management"]
    end

    %% Data Flows from Users to Login
    Student --> Login
    Officer --> Login
    OSA --> Login

    %% Login to Dashboards
    Login -->|Student Role| StudentDash
    Login -->|Officer Role| OfficerDash
    Login -->|OSA Role| OSADash

    %% Student Dashboard Data Flows
    StudentDash -->|View Events| Events
    StudentDash -->|View Announcements| Announcements
    StudentDash -->|Access Services| QRAttendance
    StudentDash -->|Rental Request| IGPRental

    %% Officer Dashboard Data Flows
    OfficerDash -->|Create| Announcements
    OfficerDash -->|Manage| Events
    OfficerDash -->|Submit| Documents
    OfficerDash -->|View| Analytics
    OfficerDash -->|Track Rentals| IGPRental
    OfficerDash -->|Monitor Attendance| QRAttendance

    %% OSA Dashboard Data Flows
    OSADash -->|Review & Approve| Documents
    OSADash -->|Audit| Analytics
    OSADash -->|Approve| Announcements
    OSADash -->|Oversee| Events

    %% Core Modules to Backend
    Announcements -->|Store Posts| Firebase
    Events -->|Store Schedules| Firebase
    Documents -->|Upload PDFs| Storage
    Documents -->|Track Status| Firebase
    Analytics -->|Query Data| Firebase

    %% Specialized Systems to Backend
    QRAttendance -->|Log Attendance| Firebase
    QRAttendance -->|Offline Mode| OfflineQueue
    IGPRental -->|Update Inventory| Firebase
    IGPRental -->|Transaction Logs| Firebase
    IGPRental -->|Offline Mode| OfflineQueue

    %% Backend Sync
    OfflineQueue -->|Sync When Online| Firebase
    Firebase -->|Real-time Updates| Dashboards
    Storage -->|Serve Documents| Documents

    %% Styling
    classDef userClass fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef dashClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef moduleClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef specialClass fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef backendClass fill:#fce4ec,stroke:#880e4f,stroke-width:2px

    class Student,Officer,OSA userClass
    class StudentDash,OfficerDash,OSADash dashClass
    class Announcements,Events,Documents,Analytics moduleClass
    class QRAttendance,IGPRental specialClass
    class Firebase,Storage,OfflineQueue backendClass
```

## Component Description

### **System Users**
- **Students**: Access event information, announcements, and rental services
- **Organization Officers**: Manage events, documents, analytics, and organizational operations
- **OSA Staff**: Administrative oversight, approvals, and auditing

### **User Interfaces**
- **Student Dashboard**: Public-facing portal for event engagement and service access
- **Officer Dashboard**: Management portal with analytics, document submission, and service tracking
- **OSA Dashboard**: Administrative interface for approvals, auditing, and oversight

### **Core System Modules**
- **Announcement System**: Create, distribute, and manage organizational announcements
- **Event Management**: Schedule events, create calendar entries, and track participation
- **Document Workflow**: Submit proposals, reports, and resolutions with approval tracking
- **Analytics Engine**: Generate financial, participation, and inventory visualizations

### **Specialized Modules**
- **QR-Attendance System**: Barcode/QR scanning with time-in/out tracking and offline support
- **IGP Rental System**: Point-of-sale equipment rental with inventory management and offline capability

### **Backend Services**
- **Firebase Services**: Real-time database for all application data
- **Document Storage**: Centralized PDF repository for organizational documents
- **Offline Queue Service**: Local storage and synchronization for offline operations

## Data Flow Patterns

### **1. Student Engagement Flow**
```
Student → Login → Student Dashboard → View Events/Announcements
                                   → Access QR Attendance
                                   → Request Equipment Rental
```

### **2. Officer Management Flow**
```
Officer → Login → Officer Dashboard → Create Announcements → Firebase
                                   → Submit Documents → Storage
                                   → View Analytics → Query Firebase
                                   → Track Services → Specialized Systems
```

### **3. Administrative Oversight Flow**
```
OSA Staff → Login → OSA Dashboard → Review Documents → Update Status
                                  → Approve Announcements → Firebase
                                  → Audit Analytics → Query Firebase
```

### **4. Offline Synchronization Flow**
```
QR/IGP System → Offline Queue Service → Store Locally
                                      → Detect Connection
                                      → Sync to Firebase
```

## Key System Characteristics

### **Multi-Tenant Architecture**
- Role-based access control (Student, Officer, OSA)
- Dedicated dashboards per user type
- Shared backend services with permission layers

### **Real-Time Data**
- Firebase real-time database for instant updates
- Live synchronization across all connected clients
- Event-driven notifications

### **Offline Resilience**
- Local queue system for QR Attendance and IGP Rental
- Automatic synchronization when connection restored
- Uninterrupted service during network outages

### **Document Lifecycle**
- Upload → Review → Approval/Rejection → Archival
- Status tracking at every stage
- Integrated PDF viewer with annotation tools

---

## Notes
- This diagram emphasizes **component interaction** and **data movement**, not detailed logic flow
- Each module operates independently while sharing common backend services
- The system supports both online and offline operational modes for critical functions
