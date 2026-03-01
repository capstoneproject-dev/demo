$code = @"
flowchart LR
    ISOMSYS["Integrated Student\nOrganization\nManagement System"]
    Students["Students"]
    Officers["Organization\nOfficers"]
    OSA["OSA\nAdministrators"]
    Attendees["Event Attendees /\nGuests"]
    Renters["Renters"]
    Students -->|"Registration, Login,\nDocument Submissions, Rentals"| ISOMSYS
    ISOMSYS -->|"Approvals, Announcements,\nRental Status"| Students
    Officers -->|"Registration, Login, Event Setup,\nAttendance Scans, Announcements,\nDocument Submissions, Rental Processing"| ISOMSYS
    ISOMSYS -->|"Attendance Confirmations,\nRepository Status, Inventory Updates"| Officers
    OSA -->|"Registration, Login, Approval,\nPolicies, Campus Announcements"| ISOMSYS
    ISOMSYS -->|"Registration Decisions,\nOversight Dashboards,\nDocument Submissions"| OSA
    Attendees -->|"Barcode Scans /\nAttendance Data"| ISOMSYS
    ISOMSYS -->|"Attendance Confirmation"| Attendees
    Renters -->|"Rental Requests / Returns"| ISOMSYS
    ISOMSYS -->|"Item hand-off instructions, fees"| Renters
"@

$obj = @{ code = $code; mermaid = @{ theme = "default" } }
$json = $obj | ConvertTo-Json -Compress -Depth 5
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$b64 = [Convert]::ToBase64String($bytes)
$url = "https://mermaid.live/edit#base64:$b64"
$url | Out-File "C:\xampp\htdocs\CAPSTONE\demo\TEMP\mermaid_url.txt" -Encoding UTF8
Write-Host $url
