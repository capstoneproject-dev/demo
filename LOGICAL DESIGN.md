erDiagram

    institutes {
        int      institute_id    PK
        varchar  institute_name
        bool     is_active
    }

    academic_programs {
        int      program_id      PK
        int      institute_id    FK
        varchar  program_code
        bool     is_active
    }

    users {
        int      user_id             PK
        int      program_id          FK
        int      institute_id        FK
        varchar  student_number
        varchar  employee_number
        varchar  first_name
        varchar  last_name
        varchar  email
        varchar  phone
        varchar  password_hash
        varchar  account_type
        bool     has_unpaid_debt
        bool     is_active
        datetime last_login_at
    }

    student_numbers {
        int      sn_id               PK
        int      program_id          FK
        int      institute_id        FK
        int      added_by_user_id    FK
        varchar  student_number
        varchar  student_name
        varchar  year_section
        bool     is_active
    }

    pending_registrations {
        int      reg_id                  PK
        int      reviewed_by_user_id     FK
        varchar  student_number
        varchar  student_name
        varchar  email
        varchar  phone
        varchar  program_code
        varchar  year_section
        varchar  requested_role
        varchar  requested_org
        varchar  status
        text     reviewer_notes
        datetime requested_at
        datetime reviewed_at
    }

    organizations {
        int      org_id      PK
        varchar  org_name
        varchar  org_code
        varchar  logo_url
        varchar  status
    }

    org_roles {
        int      role_id                     PK
        int      org_id                      FK
        varchar  role_name
        bool     can_access_org_dashboard
        bool     is_active
    }

    organization_members {
        int      membership_id   PK
        int      user_id         FK
        int      org_id          FK
        int      role_id         FK
        date     joined_at
        bool     is_active
    }

    program_org_mappings {
        int      mapping_id  PK
        int      program_id  FK
        int      org_id      FK
        bool     is_active
    }

    events {
        int      event_id            PK
        int      org_id              FK
        int      created_by_user_id  FK
        varchar  event_name
        text     description
        varchar  location
        datetime event_datetime
        varchar  event_photo
        bool     is_published
    }

    attendance_records {
        int      record_id       PK
        int      event_id        FK
        int      user_id         FK
        varchar  student_number
        varchar  student_name
        varchar  section
        datetime time_in
        datetime time_out
    }

    announcements {
        int      announcement_id     PK
        int      org_id              FK
        int      created_by_user_id  FK
        varchar  title
        text     content
        varchar  audience_type
        bool     is_published
        datetime published_at
    }

    document_submissions {
        int      submission_id           PK
        int      org_id                  FK
        int      submitted_by_user_id    FK
        int      reviewed_by_user_id     FK
        varchar  title
        varchar  document_type
        varchar  file_url
        varchar  recipient
        varchar  status
        text     reviewer_notes
        datetime submitted_at
        datetime reviewed_at
    }

    documents_approved {
        int      repo_id         PK
        int      submission_id   FK
        int      org_id          FK
        varchar  title
        varchar  document_type
        varchar  file_url
        datetime approved_at
    }

    inventory_categories {
        int      category_id     PK
        int      org_id          FK
        varchar  category_name
        bool     is_active
    }

    inventory_items {
        int      item_id                     PK
        int      org_id                      FK
        int      category_id                 FK
        varchar  item_name
        varchar  barcode
        int      stock_quantity
        int      available_quantity
        decimal  hourly_rate
        int      overtime_interval_minutes
        decimal  overtime_rate_per_block
        varchar  status
    }

    rentals {
        int      rental_id               PK
        int      org_id                  FK
        int      renter_user_id          FK
        int      processed_by_user_id    FK
        datetime rent_time
        datetime expected_return_time
        datetime actual_return_time
        decimal  total_cost
        varchar  payment_status
        varchar  payment_method
        datetime paid_at
        varchar  status
        text     notes
    }

    rental_items {
        int      rental_item_id              PK
        int      rental_id                   FK
        int      item_id                     FK
        int      quantity
        decimal  unit_rate
        decimal  item_cost
        int      overtime_interval_minutes
        decimal  overtime_rate_per_block
    }

    institutes              ||--o{ academic_programs      : "1:N offers"
    institutes              ||--o{ users                  : "1:N classifies"
    institutes              ||--o{ student_numbers        : "1:N classifies"
    academic_programs       ||--o{ users                  : "1:N enrolled in"
    academic_programs       ||--o{ student_numbers        : "1:N enrolled in"
    academic_programs       ||--o{ program_org_mappings   : "1:N"
    organizations           ||--o{ program_org_mappings   : "1:N"
    organizations           ||--o{ org_roles              : "1:N defines"
    organizations           ||--o{ organization_members   : "1:N has"
    organizations           ||--o{ events                 : "1:N hosts"
    organizations           ||--o{ announcements          : "1:N issues"
    organizations           ||--o{ document_submissions   : "1:N files"
    organizations           ||--o{ documents_approved     : "1:N stores"
    organizations           ||--o{ inventory_categories   : "1:N owns"
    organizations           ||--o{ inventory_items        : "1:N owns"
    organizations           ||--o{ rentals                : "1:N manages"
    org_roles               ||--o{ organization_members   : "1:N assigned via"
    users                   ||--o{ organization_members   : "1:N member via"
    users                   ||--o{ events                 : "1:N creates"
    users                   ||--o{ attendance_records     : "1:N recorded in"
    users                   ||--o{ announcements          : "1:N authors"
    users                   ||--o{ document_submissions   : "1:N submits"
    users                   ||--o{ document_submissions   : "1:N reviews"
    users                   ||--o{ rentals                : "1:N rents"
    users                   ||--o{ rentals                : "1:N processes"
    users                   ||--o{ student_numbers        : "1:N added by"
    users                   ||--o{ pending_registrations  : "1:N reviews"
    events                  ||--o{ attendance_records     : "1:N logs"
    document_submissions    ||--o| documents_approved     : "1:1 approved into"
    inventory_categories    ||--o{ inventory_items        : "1:N groups"
    inventory_items         ||--o{ rental_items           : "1:N included via"
    rentals                 ||--o{ rental_items           : "1:N contains"