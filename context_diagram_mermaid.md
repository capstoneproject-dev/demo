# AISERS Context Diagram - Mermaid Code

## ⚠️ IMPORTANT: Copy ONLY the code below (without the ```mermaid markers)

Copy from the line starting with `%%{init` to the line with `linkStyle default` and paste into https://mermaid.live

---

**START COPYING FROM HERE:**

graph LR
    %% External Entities (Rectangles)
    Officer["Student Organization<br/>Officers"]
    OSA["OSA Staff<br/>(Office of Student Affairs)"]
    Student["Students"]
    Scanner["QR/Barcode<br/>Scanners"]
    Calendar["Calendar<br/>System"]
    Storage["Document<br/>Storage"]
    
    %% Central System (Oval)
    AISERS(["AISERS<br/>Student Organization<br/>Management System"])
    
    %% Officer Interactions - TO System
    Officer -->|"Event Data"| AISERS
    Officer -->|"Announcements"| AISERS
    Officer -->|"Document Submissions"| AISERS
    Officer -->|"Inventory Management"| AISERS
    Officer -->|"Attendance Records"| AISERS
    Officer -->|"Financial Transactions"| AISERS
    
    %% Officer Interactions - FROM System
    AISERS -->|"Analytics Dashboard"| Officer
    AISERS -->|"Approval Status"| Officer
    AISERS -->|"Document Repository"| Officer
    AISERS -->|"Rental History"| Officer
    AISERS -->|"Attendance Reports"| Officer
    
    %% OSA Staff Interactions - TO System
    OSA -->|"Approval Decisions"| AISERS
    OSA -->|"Document Annotations"| AISERS
    OSA -->|"Financial Audit Records"| AISERS
    OSA -->|"Policy Updates"| AISERS
    
    %% OSA Staff Interactions - FROM System
    AISERS -->|"Pending Requests"| OSA
    AISERS -->|"Organization Reports"| OSA
    AISERS -->|"Financial Summaries"| OSA
    AISERS -->|"Document Status"| OSA
    AISERS -->|"Compliance Reports"| OSA
    
    %% Student Interactions - TO System
    Student -->|"Search Queries"| AISERS
    Student -->|"Equipment Rental Requests"| AISERS
    Student -->|"Event Check-In"| AISERS
    Student -->|"Equipment Returns"| AISERS
    
    %% Student Interactions - FROM System
    AISERS -->|"Event Calendar"| Student
    AISERS -->|"Event Feed"| Student
    AISERS -->|"Rental Availability"| Student
    AISERS -->|"Payment Notifications"| Student
    AISERS -->|"Rental History"| Student
    
    %% Scanner Integration - TO System
    Scanner -->|"QR/Barcode Scans"| AISERS
    Scanner -->|"Student ID Data"| AISERS
    Scanner -->|"Equipment Tags"| AISERS
    Scanner -->|"Time-In/Time-Out"| AISERS
    
    %% Scanner Integration - FROM System
    AISERS -->|"Validation Response"| Scanner
    AISERS -->|"Duplicate Alerts"| Scanner
    AISERS -->|"Sync Status"| Scanner
    
    %% Calendar Integration - TO System
    Calendar -->|"Event Reminders"| AISERS
    Calendar -->|"Notifications"| AISERS
    
    %% Calendar Integration - FROM System
    AISERS -->|"Calendar Events"| Calendar
    AISERS -->|"Event Updates"| Calendar
    AISERS -->|"Cancellations"| Calendar
    
    %% Document Storage - TO System
    Storage -->|"Retrieved Documents"| AISERS
    Storage -->|"Document Metadata"| AISERS
    
    %% Document Storage - FROM System
    AISERS -->|"PDF Documents"| Storage
    AISERS -->|"Document Metadata"| Storage
    AISERS -->|"Category Data"| Storage
    
    %% Styling
    classDef entity fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    classDef system fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
    
    class Officer,OSA,Student,Scanner,Calendar,Storage entity
    class AISERS system

**STOP COPYING HERE**

---

## Alternative Version (Top-to-Bottom Layout)

**START COPYING FROM HERE:**

graph TB
    %% External Entities (Rectangles)
    Officer["Student Organization<br/>Officers"]
    OSA["OSA Staff<br/>(Office of Student Affairs)"]
    Student["Students"]
    Scanner["QR/Barcode<br/>Scanners"]
    Calendar["Calendar<br/>System"]
    Storage["Document<br/>Storage"]
    
    %% Central System (Oval)
    AISERS(["AISERS<br/>Student Organization<br/>Management System"])
    
    %% Officer Interactions - TO System
    Officer -->|"Event Data"| AISERS
    Officer -->|"Announcements"| AISERS
    Officer -->|"Document Submissions"| AISERS
    Officer -->|"Inventory Management"| AISERS
    Officer -->|"Attendance Records"| AISERS
    Officer -->|"Financial Transactions"| AISERS
    
    %% Officer Interactions - FROM System
    AISERS -->|"Analytics Dashboard"| Officer
    AISERS -->|"Approval Status"| Officer
    AISERS -->|"Document Repository"| Officer
    AISERS -->|"Rental History"| Officer
    AISERS -->|"Attendance Reports"| Officer
    
    %% OSA Staff Interactions - TO System
    OSA -->|"Approval Decisions"| AISERS
    OSA -->|"Document Annotations"| AISERS
    OSA -->|"Financial Audit Records"| AISERS
    OSA -->|"Policy Updates"| AISERS
    
    %% OSA Staff Interactions - FROM System
    AISERS -->|"Pending Requests"| OSA
    AISERS -->|"Organization Reports"| OSA
    AISERS -->|"Financial Summaries"| OSA
    AISERS -->|"Document Status"| OSA
    AISERS -->|"Compliance Reports"| OSA
    
    %% Student Interactions - TO System
    Student -->|"Search Queries"| AISERS
    Student -->|"Equipment Rental Requests"| AISERS
    Student -->|"Event Check-In"| AISERS
    Student -->|"Equipment Returns"| AISERS
    
    %% Student Interactions - FROM System
    AISERS -->|"Event Calendar"| Student
    AISERS -->|"Event Feed"| Student
    AISERS -->|"Rental Availability"| Student
    AISERS -->|"Payment Notifications"| Student
    AISERS -->|"Rental History"| Student
    
    %% Scanner Integration - TO System
    Scanner -->|"QR/Barcode Scans"| AISERS
    Scanner -->|"Student ID Data"| AISERS
    Scanner -->|"Equipment Tags"| AISERS
    Scanner -->|"Time-In/Time-Out"| AISERS
    
    %% Scanner Integration - FROM System
    AISERS -->|"Validation Response"| Scanner
    AISERS -->|"Duplicate Alerts"| Scanner
    AISERS -->|"Sync Status"| Scanner
    
    %% Calendar Integration - TO System
    Calendar -->|"Event Reminders"| AISERS
    Calendar -->|"Notifications"| AISERS
    
    %% Calendar Integration - FROM System
    AISERS -->|"Calendar Events"| Calendar
    AISERS -->|"Event Updates"| Calendar
    AISERS -->|"Cancellations"| Calendar
    
    %% Document Storage - TO System
    Storage -->|"Retrieved Documents"| AISERS
    Storage -->|"Document Metadata"| AISERS
    
    %% Document Storage - FROM System
    AISERS -->|"PDF Documents"| Storage
    AISERS -->|"Document Metadata"| Storage
    AISERS -->|"Category Data"| Storage
    
    %% Styling
    classDef entity fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    classDef system fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
    
    class Officer,OSA,Student,Scanner,Calendar,Storage entity
    class AISERS system

**STOP COPYING HERE**

---

## Instructions

1. Go to https://mermaid.live
2. **Copy ONLY the code between "START COPYING" and "STOP COPYING"** (do NOT include the ```mermaid markers)
3. Paste it into the editor
4. The diagram will automatically render

**Choose:**
- **First version**: Left-to-right (LR) layout - better for wide displays
- **Second version**: Top-to-bottom (TB) layout - better for vertical displays

Both versions show:
- External entities as **rectangles**
- AISERS system as an **oval**
- Each data flow on its own line with clear labels
- Organized by interaction type (TO/FROM system)
