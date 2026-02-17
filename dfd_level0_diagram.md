# AISERS DFD Level 0 Diagram

## Standard Data Flow Diagram - Level 0 (Context Diagram)

### Instructions
1. Copy the code below (between START and STOP markers)
2. Paste into https://mermaid.live to generate the image
3. Export as PNG or SVG

---

**START COPYING FROM HERE:**

```mermaid
graph LR
    %% External Entities (Rectangles)
    Officer["Student Organization<br/>Officers"]
    OSA["OSA Staff"]
    Student["Students"]
    Scanner["QR/Barcode<br/>Scanners"]
    Calendar["Calendar<br/>System"]
    Storage["Document<br/>Storage"]
    
    %% Central Process (Circle)
    AISERS(["AISERS<br/>Student Org<br/>Management<br/>System"])
    
    %% Data Flows - Officer (Covers: Analytics, Announcements, Events, Documents, Inventory, Attendance, Financials)
    Officer -->|"operational data"| AISERS
    AISERS -->|"analytics & reports"| Officer
    
    %% Data Flows - OSA (Covers: Financial Auditing, Approval System, Document Workflow)
    OSA -->|"approvals of documents"| AISERS
    AISERS -->|"oversight reports"| OSA
    
    %% Data Flows - Student (Covers: Event Feed, Search, Rental Requests, Check-ins)
    Student -->|"service requests"| AISERS
    AISERS -->|"services & information"| Student
    
    %% Data Flows - Scanner (Covers: QR-Attendance + IGP Rental barcode scanning)
    Scanner -->|"scan data"| AISERS
    AISERS -->|"validation results"| Scanner
    
    %% Data Flows - Calendar (Covers: Event Integration, Calendar Display)
    Calendar -->|"reminders"| AISERS
    AISERS -->|"event updates"| Calendar
    
    %% Data Flows - Storage (Covers: Document Repository, PDF Submissions)
    Storage -->|"stored documents"| AISERS
    AISERS -->|"document submissions"| Storage
    
    %% Styling
    classDef entity fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    classDef process fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
    
    class Officer,OSA,Student,Scanner,Calendar,Storage entity
    class AISERS process
```

**STOP COPYING HERE**

---

## Alternative Ultra-Simple Version (Most Generalized)

**START COPYING FROM HERE:**

```mermaid
graph LR
    %% External Entities
    Officer["Organization<br/>Officers"]
    OSA["OSA Staff"]
    Student["Students"]
    
    %% Central Process
    AISERS(["AISERS"])
    
    %% Data Flows - Only Core Entities
    Officer -->|"management data"| AISERS
    AISERS -->|"reports"| Officer
    
    OSA -->|"approvals"| AISERS
    AISERS -->|"reports"| OSA
    
    Student -->|"requests"| AISERS
    AISERS -->|"information"| Student
    
    %% Styling
    classDef entity fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    classDef process fill:#fff9c4,stroke:#f57f17,stroke-width:3px,color:#000
    
    class Officer,OSA,Student entity
    class AISERS process
```

**STOP COPYING HERE**

---

## Notes on Standard DFD Level 0 Notation

- **External Entities** (rectangles): People, organizations, or systems outside the system boundary
- **Process** (circle/oval): The single main process being modeled (AISERS)
- **Data Flows** (arrows): **Generalized, high-level** data movement (not detailed lists)
- **Level 0** means this is the highest-level view with simplified, abstracted data flows

## Key Difference from Context Diagram

**Context Diagram** (detailed):
- Shows every specific data flow separately
- Example: "Event Data", "Announcements", "Document Submissions", "Inventory Management", etc.
- More comprehensive but visually complex

**DFD Level 0** (simplified):
- Groups related flows into high-level categories
- Example: "operational data", "analytics & reports"
- Fewer arrows, more abstract terminology
- Follows traditional textbook DFD notation

---

## Coverage of System Features

This DFD Level 0 covers all 5 modules from system_features.md:

### **Officer Dashboard** → "operational data" / "analytics & reports"
Covers: Analytics Dashboard, Announcements, Event Integration, Document Workflow, Service Tracker, Events Calendar

### **OSA Dashboard** → "approvals & policies" / "oversight reports"
Covers: Financial Auditing, Approval System, Request Management, Document Workflow, Filtering

### **Student Dashboard** → "service requests" / "services & information"
Covers: Event Feed, Calendar, Search functionality

### **QR-Attendance System** → "scan data" / "validation results"
Covers: Fast Scanning, Time-In/Time-Out, Duplicate Prevention, Offline Mode, Export

### **IGP Rental System** → "scan data" / "validation results" + "service requests" / "services & information"
Covers: Inventory Catalog, Cart System, Barcode Checkout, Rental History, Automated Pricing, Unpaid Blocking, Offline Capability

### **Supporting Systems**
- **Calendar** → "reminders" / "event updates": Handles event integration and calendar synchronization
- **Storage** → "stored documents" / "document submissions": Manages PDF repository and submissions

## To Generate Image:
1. Visit https://mermaid.live
2. Copy code from between the START/STOP markers
3. Paste into the editor (the diagram will auto-render)
4. Click "Actions" → "Download PNG" or "Download SVG"

## Alternative Tools:
- Use VS Code with Mermaid Preview extension
- Use draw.io and manually recreate using DFD shapes
- Use any Mermaid renderer/converter online
