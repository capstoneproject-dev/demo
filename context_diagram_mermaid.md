# AISERS Context Diagram - Mermaid Code

## ⚠️ IMPORTANT: Copy ONLY the code below (without the ```mermaid markers)

Copy from the line starting with `%%{init` to the line with `linkStyle default` and paste into https://mermaid.live

---

**START COPYING FROM HERE:**

%%{init: {'theme':'base', 'themeVariables': { 'fontSize':'16px'}}}%%
graph TB
    %% External Entities (Rectangles)
    Officer["Student Organization Officers"]
    OSA["OSA Staff (Office of Student Affairs)"]
    Student["Students"]
    Scanner["QR/Barcode Scanners"]
    Calendar["Calendar System"]
    Storage["Document Storage"]
    
    %% Central System (Oval)
    AISERS(["AISERS<br/>Student Organization Management System"])
    
    %% Spacers for better layout
    space1[" "]
    space2[" "]
    space3[" "]
    space4[" "]
    space5[" "]
    space6[" "]
    
    %% Officer to System
    Officer -->|Event Data| AISERS
    Officer -->|Announcements| AISERS
    Officer -->|Document Submissions| AISERS
    Officer -->|Inventory Management| AISERS
    Officer -->|Attendance Records| AISERS
    Officer -->|Financial Transactions| AISERS
    
    %% System to Officer
    AISERS -->|Analytics Dashboard| Officer
    AISERS -->|Approval Status| Officer
    AISERS -->|Document Repository| Officer
    AISERS -->|Rental History| Officer
    AISERS -->|Attendance Reports| Officer
    
    %% OSA to System
    OSA -->|Approval Decisions| AISERS
    OSA -->|Document Annotations| AISERS
    OSA -->|Financial Audit Records| AISERS
    OSA -->|Policy Updates| AISERS
    
    %% System to OSA
    AISERS -->|Pending Requests| OSA
    AISERS -->|Organization Reports| OSA
    AISERS -->|Financial Summaries| OSA
    AISERS -->|Document Status| OSA
    AISERS -->|Compliance Reports| OSA
    
    %% Student to System
    Student -->|Search Queries| AISERS
    Student -->|Equipment Rental Requests| AISERS
    Student -->|Event Check-In| AISERS
    Student -->|Equipment Returns| AISERS
    
    %% System to Student
    AISERS -->|Event Calendar| Student
    AISERS -->|Event Feed| Student
    AISERS -->|Rental Availability| Student
    AISERS -->|Payment Notifications| Student
    AISERS -->|Rental History| Student
    
    %% Scanner to System
    Scanner -->|QR/Barcode Scans| AISERS
    Scanner -->|Student ID Data| AISERS
    Scanner -->|Equipment Tags| AISERS
    Scanner -->|Time-In/Time-Out| AISERS
    
    %% System to Scanner
    AISERS -->|Validation Response| Scanner
    AISERS -->|Duplicate Alerts| Scanner
    AISERS -->|Sync Status| Scanner
    
    %% Calendar to System
    Calendar -->|Event Reminders| AISERS
    Calendar -->|Notifications| AISERS
    
    %% System to Calendar
    AISERS -->|Calendar Events| Calendar
    AISERS -->|Event Updates| Calendar
    AISERS -->|Cancellations| Calendar
    
    %% Storage to System
    Storage -->|Retrieved Documents| AISERS
    Storage -->|Document Metadata| AISERS
    
    %% System to Storage
    AISERS -->|PDF Documents| Storage
    AISERS -->|Document Metadata| Storage
    AISERS -->|Category Data| Storage
    
    %% Styling
    classDef entity fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    classDef system fill:#fff9c4,stroke:#f57f17,stroke-width:4px,color:#000
    classDef invisible fill:none,stroke:none,color:transparent
    
    class Officer,OSA,Student,Scanner,Calendar,Storage entity
    class AISERS system
    class space1,space2,space3,space4,space5,space6 invisible
    
    %% Make lines straight
    linkStyle default stroke-width:2px

**STOP COPYING HERE**

---

## Alternative Version (More Compact)

**START COPYING FROM HERE:**

graph TB
    %% Define all nodes
    Officer["Student Organization<br/>Officers"]
    OSA["OSA Staff<br/>(Office of Student Affairs)"]
    Student["Students"]
    Scanner["QR/Barcode<br/>Scanners"]
    Calendar["Calendar<br/>System"]
    Storage["Document<br/>Storage"]
    AISERS(["AISERS<br/>Student Organization<br/>Management System"])
    
    %% Data Flows
    Officer -->|Event Data| AISERS
    Officer -->|Announcements| AISERS
    Officer -->|Document Submissions| AISERS
    Officer -->|Inventory Management| AISERS
    Officer -->|Attendance Records| AISERS
    Officer -->|Financial Transactions| AISERS
    
    AISERS -->|Analytics Dashboard| Officer
    AISERS -->|Approval Status| Officer
    AISERS -->|Document Repository| Officer
    AISERS -->|Rental History| Officer
    AISERS -->|Attendance Reports| Officer
    
    OSA -->|Approval Decisions| AISERS
    OSA -->|Document Annotations| AISERS
    OSA -->|Financial Audit Records| AISERS
    OSA -->|Policy Updates| AISERS
    
    AISERS -->|Pending Requests| OSA
    AISERS -->|Organization Reports| OSA
    AISERS -->|Financial Summaries| OSA
    AISERS -->|Document Status| OSA
    AISERS -->|Compliance Reports| OSA
    
    Student -->|Search Queries| AISERS
    Student -->|Equipment Rental Requests| AISERS
    Student -->|Event Check-In| AISERS
    Student -->|Equipment Returns| AISERS
    
    AISERS -->|Event Calendar| Student
    AISERS -->|Event Feed| Student
    AISERS -->|Rental Availability| Student
    AISERS -->|Payment Notifications| Student
    AISERS -->|Rental History| Student
    
    Scanner -->|QR/Barcode Scans| AISERS
    Scanner -->|Student ID Data| AISERS
    Scanner -->|Equipment Tags| AISERS
    Scanner -->|Time-In/Time-Out| AISERS
    
    AISERS -->|Validation Response| Scanner
    AISERS -->|Duplicate Alerts| Scanner
    AISERS -->|Sync Status| Scanner
    
    Calendar -->|Event Reminders| AISERS
    Calendar -->|Notifications| AISERS
    
    AISERS -->|Calendar Events| Calendar
    AISERS -->|Event Updates| Calendar
    AISERS -->|Cancellations| Calendar
    
    Storage -->|Retrieved Documents| AISERS
    Storage -->|Document Metadata| AISERS
    
    AISERS -->|PDF Documents| Storage
    AISERS -->|Document Metadata| Storage
    AISERS -->|Category Data| Storage
    
    %% Styling
    classDef entity fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    classDef system fill:#fff9c4,stroke:#f57f17,stroke-width:4px,color:#000
    
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
- **First version**: Has spacing helpers and theme configuration
- **Second version**: More compact and clean

Both versions show:
- External entities as **rectangles**
- AISERS system as an **oval**
- Each data flow on its own **straight line** with clear labels
