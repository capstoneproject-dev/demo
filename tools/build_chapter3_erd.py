"""Build offline ERD artifacts from the captured, metadata-only local schema."""
from pathlib import Path
import json
from html import escape
import xml.etree.ElementTree as ET
import heapq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'md' / 'erd'
OUT.mkdir(exist_ok=True)
schema = json.loads((ROOT / 'md/Chapter 3 ERD Schema Snapshot.json').read_text())
tables = schema['tables']
excluded = {
 'api_rate_limit_buckets': 'API throttling counters; technical security mechanism.',
 'audit_logs': 'Cross-cutting administrative/security audit history; include in a separate audit ERD if audit management is a Chapter 3 objective.',
 'email_otp_challenges': 'Temporary verification codes and token lifecycle.',
 'notification_email_deliveries': 'Email delivery queue, attempts, and transport outcomes.',
 'notification_email_dispatch_state': 'Email dispatcher scheduling and runtime state.',
 'offline_operations': 'Synchronization receipts and replay/idempotency bookkeeping; include in a separate synchronization ERD if offline synchronization is a Chapter 3 objective.',
 'osa_staff_invitations': 'Staff invitation onboarding and token/delivery lifecycle; core staff accounts remain in users.',
 'student_email_notification_preferences': 'Optional delivery preferences rather than a core business transaction.',
 'system_settings': 'Generic application configuration; academic terms and pricing remain visible as business attributes.',
 'user_presence': 'Session presence and last-seen tracking.'
}
reasons = {
 'institutes': 'Academic institute reference used by programs, accounts, and eligibility records.',
 'academic_programs': 'Academic program reference used for affiliation and targeted announcements.',
 'student_numbers': 'Student eligibility roster, independent of registered user accounts.',
 'users': 'Student, organization adviser, and OSA identities; officers use organization memberships.',
 'pending_registrations': 'Registration requests and their approval/rejection lifecycle.',
 'organizations': 'Organization identity and service ownership.',
 'program_org_mappings': 'Program-to-organization affiliation mapping.',
 'org_roles': 'Organization-specific roles and permissions, including document review.',
 'organization_members': 'Account membership and assigned organization role.',
 'announcements': 'Organization announcements and publication state.',
 'announcement_program_targets': 'Junction for program-targeted announcement audiences.',
 'events': 'Organization events and their academic-term attributes.',
 'attendance_records': 'Event registration and attendance/check-in/check-out records.',
 'document_submissions': 'Submitted documents and current workflow state.',
 'document_versions': 'Document revision lineage, version numbers, and file hashes.',
 'document_decisions': 'Adviser, SSC, and OSA approval/rejection decisions per submission.',
 'document_annotations': 'Reviewer comments tied to document pages and selected text.',
 'documents_approved': 'Approved document repository snapshots.',
 'inventory_categories': 'Organization-owned service/inventory categories.',
 'inventory_items': 'Equipment and lockers, including rental pricing and availability.',
 'rentals': 'Equipment/locker transactions, due dates, payment state, and locker periods.',
 'rental_items': 'Rental line items connecting transactions to inventory.',
 'print_jobs': 'Printing requests, queue/status lifecycle, and payment details.'
}
included = sorted(reasons)
assert set(included).isdisjoint(excluded)
assert set(included) | set(excluded) == set(tables)

# p, child, child column, parent column, parent optional, child max one, enforcement
relations = []
for child in included:
    for fk in tables[child]['foreign_keys']:
        p, col, pc = fk['REFERENCED_TABLE_NAME'], fk['COLUMN_NAME'], fk['REFERENCED_COLUMN_NAME']
        if p not in included: continue
        # The composite org/role and org/category constraints are documented separately.
        if fk['CONSTRAINT_NAME'] in ('fk_org_members_org_role', 'fk_inventory_org_category'): continue
        c = next(c for c in tables[child]['columns'] if c['COLUMN_NAME'] == col)
        idx = tables[child]['indexes']
        unique_names = {i['INDEX_NAME'] for i in idx if i['NON_UNIQUE'] == 0}
        one = any([i['COLUMN_NAME'] for i in idx if i['INDEX_NAME'] == name] == [col] for name in unique_names)
        relations.append((p, child, col, pc, c['IS_NULLABLE'] == 'YES', one, 'DB'))

logical = [
 ('institutes','users','institute_id','institute_id',True,False),
 ('academic_programs','users','program_id','program_id',True,False),
 ('institutes','student_numbers','institute_id','institute_id',True,False),
 ('academic_programs','student_numbers','program_id','program_id',True,False),
 ('users','student_numbers','added_by_user_id','user_id',True,False),
 ('student_numbers','users','student_number','student_number',True,True),
 ('student_numbers','pending_registrations','student_number','student_number',True,False),
 ('users','pending_registrations','reviewed_by_user_id','user_id',True,False),
 ('academic_programs','program_org_mappings','program_id','program_id',False,False),
 ('organizations','program_org_mappings','org_id','org_id',False,False),
 ('users','document_versions','created_by_user_id','user_id',False,False),
 ('users','document_decisions','reviewed_by_user_id','user_id',False,False),
 ('users','document_submissions','forwarded_by_user_id','user_id',True,False),
 ('users','document_submissions','cancelled_by_user_id','user_id',True,False),
 ('organizations','rentals','org_id','org_id',False,False),
 ('users','rentals','renter_user_id','user_id',False,False),
 ('users','rentals','processed_by_user_id','user_id',False,False),
 ('users','rentals','locker_notice_sent_by_user_id','user_id',True,False),
 ('users','rentals','locker_upcoming_notice_sent_by_user_id','user_id',True,False),
 ('rentals','rental_items','rental_id','rental_id',False,False),
 ('inventory_items','rental_items','item_id','item_id',False,False),
 ('users','print_jobs','last_updated_by_user_id','user_id',True,False),
]
for r in logical:
    assert any(c['COLUMN_NAME'] == r[2] for c in tables[r[1]]['columns']), r
    assert any(c['COLUMN_NAME'] == r[3] for c in tables[r[0]]['columns']), r
    assert not any(f['COLUMN_NAME'] == r[2] and f['REFERENCED_TABLE_NAME'] == r[0] for f in tables[r[1]]['foreign_keys']), r
    relations.append((*r, 'APP'))

fields = {
 'institutes': 'institute_id institute_name is_active',
 'academic_programs': 'program_id institute_id program_code is_active',
 'student_numbers': 'sn_id student_number student_name program_id institute_id year_section academic_year is_active',
 'users': 'user_id student_number employee_number program_id institute_id email account_type is_active',
 'pending_registrations': 'reg_id student_number employee_number requested_role requested_org status reviewed_by_user_id',
 'organizations': 'org_id org_name org_code status can_offer_printing can_offer_services',
 'program_org_mappings': 'mapping_id program_id org_id is_active',
 'org_roles': 'role_id org_id role_name can_review_org_documents is_active',
 'organization_members': 'membership_id user_id org_id role_id position_title is_active',
 'announcements': 'announcement_id org_id created_by_user_id title audience_type is_published',
 'announcement_program_targets': 'target_id announcement_id program_id',
 'events': 'event_id org_id created_by_user_id event_name event_datetime academic_year semester grading_period',
 'attendance_records': 'record_id event_id user_id student_number time_in time_out',
 'document_submissions': 'submission_id org_id submitted_by_user_id reviewed_by_user_id document_type recipient status academic_year',
 'document_versions': 'version_id submission_id root_submission_id parent_submission_id version_number file_sha256 created_by_user_id',
 'document_decisions': 'decision_id submission_id review_stage decision reviewed_by_user_id decided_at',
 'document_annotations': 'annotation_id submission_id created_by_user_id page_number selected_text comment_text',
 'documents_approved': 'repo_id submission_id org_id approved_by_user_id title approved_at',
 'inventory_categories': 'category_id org_id category_name is_active',
 'inventory_items': 'item_id org_id category_id item_name barcode hourly_rate status locker_monthly_rate',
 'rentals': 'rental_id org_id renter_user_id processed_by_user_id service_kind locker_period_type status payment_status',
 'rental_items': 'rental_item_id rental_id item_id quantity unit_rate item_cost',
 'print_jobs': 'print_job_id org_id user_id file_name status queue_order total_cost payment_status',
}
fields = {t: v.split() for t,v in fields.items()}

def tags(t, col):
    c = next(c for c in tables[t]['columns'] if c['COLUMN_NAME'] == col)
    result = []
    if c['COLUMN_KEY'] == 'PRI': result.append('PK')
    if any(f['COLUMN_NAME'] == col for f in tables[t]['foreign_keys']): result.append('FK')
    elif any(r[1] == t and r[2] == col for r in relations): result.append('REF')
    if c['IS_NULLABLE'] == 'YES': result.append('NULL')
    return ', '.join(result)

def mermaid(nodes, rels):
    lines = ['erDiagram', '    direction LR']
    for t in nodes:
        lines.append('    '+t+' {')
        for col in fields[t]:
            c = next(c for c in tables[t]['columns'] if c['COLUMN_NAME'] == col)
            typ = c['COLUMN_TYPE'].split('(')[0].replace(' ', '_')
            tag = tags(t,col)
            key = ' PK' if 'PK' in tag else (' FK' if 'FK' in tag else '')
            comment = (' "'+tag+'"') if tag else ''
            lines.append(f'        {typ} {col}{key}{comment}')
        lines.append('    }')
    for p,c,col,pc,opt,one,kind in rels:
        left = '|o' if opt else '||'
        right = 'o|' if one else 'o{'
        lines.append(f'    {p} {left}{".." if kind == "APP" else "--"}{right} {c} : "{col} [{kind}]"')
    return '\n'.join(lines)+'\n'

(OUT/'chapter-3-erd.mmd').write_text(mermaid(included, relations), encoding='utf-8')

panels = [
 ('01-academics-accounts', 'Academic references and account registration',
  {'institutes':(0,0), 'academic_programs':(1,0), 'program_org_mappings':(2,0), 'student_numbers':(0,1), 'users':(1,1), 'organizations':(2,1), 'pending_registrations':(0,2)}),
 ('02-organizations-announcements', 'Organization membership and announcements',
  {'users':(0,0), 'organizations':(1,0), 'org_roles':(2,0), 'organization_members':(1,1), 'announcements':(0,1), 'announcement_program_targets':(0,2), 'academic_programs':(1,2)}),
 ('03-document-workflow', 'Document review, revisions, and approved repository',
  {'users':(0,0), 'organizations':(1,0), 'document_submissions':(1,1), 'document_versions':(2,1), 'document_annotations':(0,1), 'document_decisions':(0,2), 'documents_approved':(1,2)}),
 ('04-events-attendance', 'Events and attendance',
  {'organizations':(0,0), 'users':(2,0), 'events':(0,1), 'attendance_records':(2,1)}),
 ('05-rentals-printing', 'Inventory, equipment / locker rentals, and printing',
  {'organizations':(0,0), 'inventory_categories':(1,0), 'inventory_items':(2,0), 'users':(0,1), 'rentals':(1,1), 'rental_items':(2,1), 'print_jobs':(0,2)}),
]

def svg_panel(title, pos, rels):
    # Explicit 1 / 0..1 / 0..* multiplicities are written in the relationship key.
    # Connections identify the relationships by number to keep long FK names readable.
    w,h = 1700,1570
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{escape(title)}">',
      '<style>text{font-family:Arial,sans-serif;fill:#182d43}.edge{fill:none;stroke:#60788c;stroke-width:2}.app{stroke-dasharray:7 5}.box{fill:white;stroke:#a3b6c7;stroke-width:1.5}.head{fill:#176495}.field{font-family:Consolas,monospace;font-size:15px}.key{font-size:16px}</style>',
      '<rect width="1700" height="1570" fill="#fff"/>',
      f'<text x="45" y="43" font-size="27" font-weight="bold">AISERS — {escape(title)}</text>',
      '<text x="45" y="72" font-size="16">Chapter 3 logical ERD · capstone_db · inspected 03 October 2026 · selected attributes</text>',
      '<text x="45" y="99" font-size="15">PK = primary key · FK = declared foreign key · REF = application reference · NULL = nullable</text>']
    boxes = {t:(60+col*555,145+row*280,440,65+len(fields[t])*22) for t,(col,row) in pos.items()}
    def route(a, b, horizontal, index):
        offset = 12 + index % 5 * 2
        sign = 1 if (b[0] > a[0] if horizontal else b[1] > a[1]) else -1
        aa = (a[0]+sign*offset,a[1]) if horizontal else (a[0],a[1]+sign*offset)
        bb = (b[0]-sign*offset,b[1]) if horizontal else (b[0],b[1]-sign*offset)
        xs = sorted({30,1670,aa[0],bb[0]} | {z for x,y,w,h in boxes.values() for z in (x-offset,x+w+offset)})
        ys = sorted({120,990,aa[1],bb[1]} | {z for x,y,w,h in boxes.values() for z in (y-offset,y+h+offset)})
        def clear(u,v):
            for x,y,w,h in boxes.values():
                if u[0] == v[0]:
                    if x-6 < u[0] < x+w+6 and max(min(u[1],v[1]),y-6) < min(max(u[1],v[1]),y+h+6): return False
                elif y-6 < u[1] < y+h+6 and max(min(u[0],v[0]),x-6) < min(max(u[0],v[0]),x+w+6): return False
            return True
        start=(xs.index(aa[0]),ys.index(aa[1])); goal=(xs.index(bb[0]),ys.index(bb[1]))
        todo=[(0,start)]; costs={start:0}; previous={}
        while todo:
            cost,u=heapq.heappop(todo)
            if u==goal: break
            if cost!=costs[u]: continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                v=(u[0]+dx,u[1]+dy)
                if not (0<=v[0]<len(xs) and 0<=v[1]<len(ys)): continue
                up=(xs[u[0]],ys[u[1]]); vp=(xs[v[0]],ys[v[1]])
                if not clear(up,vp): continue
                new=cost+abs(up[0]-vp[0])+abs(up[1]-vp[1])
                if new<costs.get(v,float('inf')): costs[v]=new;previous[v]=u;heapq.heappush(todo,(new,v))
        assert goal in costs, (a,b)
        points=[]; u=goal
        while u!=start: points.append((xs[u[0]],ys[u[1]]));u=previous[u]
        points.append(aa);points.reverse();points=[a]+points+[b]
        simplified=[points[0]]
        for j in range(1,len(points)-1):
            if not (points[j-1][0]==points[j][0]==points[j+1][0] or points[j-1][1]==points[j][1]==points[j+1][1]): simplified.append(points[j])
        simplified.append(points[-1])
        longest=max(zip(simplified,simplified[1:]),key=lambda uv:abs(uv[0][0]-uv[1][0])+abs(uv[0][1]-uv[1][1]))
        label=((longest[0][0]+longest[1][0])/2,(longest[0][1]+longest[1][1])/2)
        return 'M '+' L '.join(f'{x} {y}' for x,y in simplified),label
    labels=[]
    label_positions=[]
    for i,r in enumerate(rels,1):
        p,c,col,pc,opt,one,kind=r
        x,y,bw,bh=boxes[p]; xx,yy,cw,ch=boxes[c]
        # Connect through the space between columns or the gap between rows.
        if pos[p][0] != pos[c][0]:
            right = xx>x
            a=(x+bw if right else x,y+bh/2)
            b=(xx if right else xx+cw,yy+ch/2)
            delta=(i%5-2)*8
            a=(a[0],a[1]+delta);b=(b[0],b[1]+delta)
            path,(lx,ly)=route(a,b,True,i)
        else:
            down=yy>y
            a=(x+bw/2,y+bh if down else y)
            b=(xx+cw/2,yy if down else yy+ch)
            # Offset endpoints so parallel relationships remain individually visible.
            delta=(i%5-2)*25
            a=(a[0]+delta,a[1]); b=(b[0]+delta,b[1])
            path,(lx,ly)=route(a,b,False,i)
        parts.append(f'<path class="edge {"app" if kind=="APP" else ""}" d="{path}"/>')
        points=[tuple(map(float,point.split())) for point in path[2:].split(' L ')]
        candidates=[]
        for u,v in zip(points,points[1:]):
            length=abs(u[0]-v[0])+abs(u[1]-v[1])
            if length<30: continue
            for fraction in (0.5,0.25,0.75,0.15,0.85):
                tx=u[0]+(v[0]-u[0])*fraction;ty=u[1]+(v[1]-u[1])*fraction
                if min(abs(tx-u[0])+abs(ty-u[1]),abs(tx-v[0])+abs(ty-v[1]))<14: continue
                if any(x-14<tx<x+w+14 and y-14<ty<y+h+14 for x,y,w,h in boxes.values()): continue
                if any((tx-ox)**2+(ty-oy)**2<30**2 for ox,oy in label_positions): continue
                candidates.append((length-abs(fraction-.5)*20,tx,ty))
        if candidates: _,lx,ly=max(candidates)
        label_positions.append((lx,ly))
        labels.append(f'<circle cx="{lx}" cy="{ly}" r="13" fill="white" stroke="#60788c"/><text x="{lx}" y="{ly+5}" text-anchor="middle" font-size="13">{i}</text>')
    for t,(x,y,bw,bh) in boxes.items():
        parts += [f'<rect class="box" x="{x}" y="{y}" width="{bw}" height="{bh}" rx="5"/>',
          f'<path class="head" d="M {x+5} {y} H {x+bw-5} Q {x+bw} {y} {x+bw} {y+5} V {y+38} H {x} V {y+5} Q {x} {y} {x+5} {y}"/>',
          f'<text x="{x+14}" y="{y+26}" font-size="20" font-weight="bold" style="fill:white">{t}</text>']
        for j,col in enumerate(fields[t]):
            parts.append(f'<text class="field" x="{x+14}" y="{y+62+j*22}">{escape(col)}{escape("  ["+tags(t,col)+"]") if tags(t,col) else ""}</text>')
    parts += labels
    parts.append('<text x="45" y="1010" font-size="19" font-weight="bold">Relationship key — parent multiplicity : child multiplicity</text>')
    parts.append('<text x="45" y="1038" font-size="15">Solid = database FK · dashed = application reference (no declared FK). 0..* means zero or many records.</text>')
    for i,(p,c,col,pc,opt,one,kind) in enumerate(rels,1):
        column=(i-1)//15; row=(i-1)%15
        xx=45+column*830; yy=1071+row*29
        text=f'{i}. {p} → {c}.{col}'
        parts.append(f'<text class="key" x="{xx}" y="{yy}">{escape(text)}</text>')
        parts.append(f'<text x="{xx+25}" y="{yy+13}" font-size="11" fill="#60788c">{("0..1" if opt else "1")} : {("0..1" if one else "0..*")} · {kind} · parent key {pc}</text>')
    parts.append('<text x="45" y="1545" font-size="14">Repeated entity boxes across sheets refer to the same database table. Full references and constraints: Updated Chapter 3 ERD.md.</text>')
    parts.append('</svg>')
    result='\n'.join(parts)
    ET.fromstring(result)
    return result

svg_contents=[]
for slug,title,pos in panels:
    rels=[r for r in relations if r[0] in pos and r[1] in pos]
    # Secondary administrative actors are retained in the complete source and catalog.
    rels=[r for r in rels if r[2] not in ('archived_by_user_id','forwarded_by_user_id','cancelled_by_user_id','locker_notice_sent_by_user_id','locker_upcoming_notice_sent_by_user_id','last_updated_by_user_id','added_by_user_id')]
    assert len(rels)<=30
    svg=svg_panel(title,pos,rels)
    (OUT/(slug+'.svg')).write_text(svg,encoding='utf-8')
    (OUT/(slug+'.mmd')).write_text(mermaid(list(pos),rels),encoding='utf-8')
    svg_contents.append(svg)

# A single vector overview, composed of five consistent module sheets.
combined=['<svg xmlns="http://www.w3.org/2000/svg" width="3400" height="4710" viewBox="0 0 3400 4710">','<rect width="3400" height="4710" fill="white"/>']
for i,svg in enumerate(svg_contents):
    body=svg[svg.index('>')+1:svg.rindex('</svg>')]
    combined.append(f'<g transform="translate({(i%2)*1700},{(i//2)*1570})">{body}</g>')
combined.append('<g font-family="Arial,sans-serif" fill="#182d43"><text x="1770" y="3240" font-size="38" font-weight="bold">Chapter 3 ERD scope</text><text x="1770" y="3300" font-size="27">23 business tables included · 10 support tables excluded</text>')
for i,t in enumerate(included): combined.append(f'<text x="1770" y="3360" transform="translate(0,{i*38})" font-size="25">{i+1}. {t}</text>')
combined.append('<text x="1770" y="4350" font-size="23">Use the individual sheets for readable Chapter 3 figures.</text><text x="1770" y="4390" font-size="23">This overview repeats shared tables to reduce crossing lines.</text></g></svg>')
ET.fromstring('\n'.join(combined))
(OUT/'chapter-3-erd-overview.svg').write_text('\n'.join(combined),encoding='utf-8')

html=['<!doctype html><html lang="en"><meta charset="utf-8"><title>AISERS Chapter 3 ERD</title><style>body{font-family:Arial,sans-serif;margin:24px;background:#edf2f6;color:#182d43}h1{font-size:26px}figure{background:white;margin:24px 0;border:1px solid #c9d5df}img{display:block;width:100%;height:auto}figcaption{padding:16px}button,a{color:#176495}@media print{body{margin:0;background:white}header{display:none}figure{margin:0;border:0;break-after:page}figcaption{display:none}img{width:100%;max-height:97vh;object-fit:contain}@page{size:A3 portrait;margin:8mm}</style><header><h1>AISERS — Updated Chapter 3 ERD</h1><p>23 included tables · 10 excluded tables · read-only metadata inspection, 03 October 2026.</p><p>Each sheet represents a module of the same database. Shared entities repeat. Select Print to export the five figures as a PDF.</p><button onclick="window.print()">Print / Save as PDF</button> · <a href="chapter-3-erd-overview.svg">Single vector overview</a></header>']
for slug,title,_ in panels: html.append(f'<figure><img src="{slug}.svg" alt="{escape(title)}"><figcaption>{escape(title)} · <a href="{slug}.svg">SVG</a> · <a href="{slug}.mmd">Editable Mermaid</a></figcaption></figure>')
html.append('</html>')
(OUT/'index.html').write_text('\n'.join(html),encoding='utf-8')

doc=['# Updated AISERS Chapter 3 Entity Relationship Diagram',
 '**Basis:** metadata-only inspection of the local `capstone_db` through `config/db.php` on 03 October 2026. All 33 base tables are accounted for: **23 included and 10 excluded**. No business records, credentials, or database changes were required.',
 '## Recommended scope',
 'Use a **logical ERD of the core business data**, organized into the five readable module figures below. A Chapter 3 ERD may omit support tables when its scope is clearly stated; a complete physical ERD must include all tables. These exclusions are recommendations for the core-business figure, not claims that the excluded tables are unnecessary to the application. If the chapter specifically presents audit management, offline synchronization, or invitation administration as a main objective, include the corresponding support entity in a supplementary diagram.',
 'The old ERD remains a useful foundation. Retain its core entities and add `announcement_program_targets`, `document_versions`, `document_decisions`, and `print_jobs`. These four additions bring the old diagram\'s 19 entities to the recommended 23.',
 '## Diagram files',
 '- [Download the five-page PDF](erd/chapter-3-erd.pdf) — printable Chapter 3 figures.\n- [Open the printable five-sheet diagram](erd/index.html) — works offline; browser Print can save a PDF.\n- [Single SVG overview](erd/chapter-3-erd-overview.svg) — scalable vector artwork.\n- [Complete editable Mermaid ERD](erd/chapter-3-erd.mmd) — all included entities and cataloged relationships.\n- [Captured schema metadata](Chapter%203%20ERD%20Schema%20Snapshot.json) — columns, declared foreign keys, and indexes, without row data.',
 'The SVG uses numbered connections with explicit multiplicities in the relationship key. This keeps long table and foreign-key names readable. Shared table boxes repeat across sheets and refer to one entity, not extra tables. Secondary actor references (archiving, forwarding, cancellation, notices, and similar fields) are retained in the complete Mermaid source and relationship catalog rather than every module figure. Selected business attributes are shown; the snapshot contains the full column inventory.',
 '## Included tables (23)',
 '| Table | Reason for inclusion |\n| --- | --- |']
doc += [f'| `{t}` | {reasons[t]} |' for t in included]
doc += ['## Excluded tables (10)', '| Table | Reason for exclusion from the core-business ERD |\n| --- | --- |']
doc += [f'| `{t}` | {excluded[t]} |' for t in sorted(excluded)]
doc += ['## Important changes and interpretation',
 '- **Roles and advisers:** keep `users`, `organization_members`, and `org_roles`. Do not create separate officer/adviser/SSC/OSA tables: these identities and assignments are represented by the existing account and membership structures. `users.account_type` is the current account field; organization roles have permission fields such as `can_review_org_documents`.',
 '- **Document workflow:** retain submissions, annotations, and approved snapshots; add revision lineage and staged decisions. `document_decisions.review_stage` supports `ADVISER`, `SSC`, and `OSA`. The unique `(submission_id, review_stage)` index allows at most one decision per stage for a submission, not just one decision in total.',
 '- **Revision cardinality:** a submission has zero or one `document_versions` row via unique `submission_id`. A root submission can have many version rows via `root_submission_id`. A version may point to zero or one parent submission, and a submission can be the parent of at most one direct successor via unique `parent_submission_id`. Application workflows normally create a version row for a new submission; the FK alone does not require every submission to have one.',
 '- **Approved repository:** unique `documents_approved.submission_id` gives a submission zero or one approved snapshot. Each snapshot belongs to exactly one submission.',
 '- **Printing:** `print_jobs` is a core transaction and must be shown. Requests belong to a user and an organization; payment state and total cost are stored on the job. There is no separate payment table in this schema.',
 '- **Lockers:** use `inventory_items`, `rentals`, and `rental_items`, with `service_kind`, locker period fields, and locker rates. Do not invent a `lockers` table. Rate/notice attributes omitted from compact boxes remain in the schema snapshot.',
 '- **Announcements:** `announcement_program_targets` resolves program-specific audiences; unique `(announcement_id, program_id)` prevents duplicate target pairs. General announcements may have no target rows.',
 '- **Student roster and accounts:** `student_numbers` stores eligibility records, while `users` stores accounts. Their student-number match is a logical optional one-to-one association because both student-number columns are unique and the account field is nullable. It is not a declared FK, and the database does not guarantee a matching roster record. Staff/adviser accounts need no student number. Roster profile values and account values should not be treated as one permanently synchronized record.',
 '- **Registration requests:** keep `pending_registrations` because requests are persistent workflow records. Student number and reviewer references are application-level in the inspected schema. `requested_org` is a requested code/name resolved during approval, not an `org_id` FK; no direct organization-ID relationship is invented.',
 '- **Attendance:** `attendance_records.user_id` is nullable, supporting records without a retained user-account reference. `student_number`, `student_name`, and `section` also hold attendance identity/context. `student_number` is not a declared roster FK. The unique attendance key is `(event_id, student_number)`, not `(event_id, user_id)`; nullable student numbers require application validation for duplicate handling.',
 '## Schema accuracy notes',
 'The checked live schema differs from some SQL exports and verification notes. In particular, the captured `users` table does **not** contain `year_section`, even though `md/Database Connection Feature Verification.md` reports an earlier repair. This ERD deliberately omits that account attribute until its presence is verified in the database you intend to document. The roster still contains `student_numbers.year_section`. If a web-server-only runtime configuration selects a different database than the CLI connection, inspect that database before treating this snapshot as its physical schema.',
 'Several relationships exist in application joins and writes without declared database FKs. **DB** below means a declared foreign key; **APP** means an intended/application reference whose referential integrity is not enforced by a declared FK. `REF` in a box marks such a column. APP multiplicities describe the intended valid association; dangling references remain physically possible. In the Mermaid source, solid connectors mean DB and dashed connectors mean APP as a presentation convention; they are not being used to distinguish identifying relationships.',
 'Composite FKs additionally enforce organization consistency for `organization_members.(org_id, role_id) → org_roles.(org_id, role_id)` and `inventory_items.(org_id, category_id) → inventory_categories.(org_id, category_id)`. The diagram shows the constituent entity associations once rather than drawing duplicate lines for these composite constraints.',
 '## Complete relationship catalog',
 'Read each row as: each child record references **1** or **0..1** parent; each parent may have **0..*** or **0..1** child records. A mandatory child reference does not require a parent to have children.',
 '| Parent key | Child reference | Parent per child | Children per parent | Basis |\n| --- | --- | --- | --- | --- |']
for p,c,col,pc,opt,one,kind in relations:
    doc.append(f'| `{p}.{pc}` | `{c}.{col}` | {"0..1" if opt else "1"} | {"0..1" if one else "0..*"} | {kind} |')
doc += ['## Module figures']
for i,(slug,title,_) in enumerate(panels,1):
    doc += [f'### {i}. {title}', f'![{title}](erd/{slug}.svg)', f'[Editable module source](erd/{slug}.mmd)']
doc += ['## Suggested Chapter 3 description',
 '> The entity relationship diagram presents the core business data of AISERS, covering academic references and account registration, organization membership and announcements, document review and revision history, event attendance, inventory and rentals, and printing services. Junction entities resolve program-to-organization affiliation, organization membership, announcement audiences, and rental item associations. Technical tables for authentication tokens, session presence, request throttling, synchronization receipts, email delivery, generic settings, and administrative auditing are outside the scope of this core-business diagram. Application-level references are distinguished from declared foreign keys.',
 'Suggested captions: **Figure 8. AISERS Entity Relationship Diagram**, using the overview, or **Figures 8a–8e. AISERS Entity Relationship Diagram by Module**, using the readable sheets. Adjust numbering to match the thesis.',
 '## Validation',
 'The generation script checks that all 33 tables belong to exactly one inclusion category, all illustrated fields exist in the captured schema, application references do not duplicate declared FKs, and all SVG files parse as XML. The database was inspected using only information-schema SELECT queries. These documentation checks do not assert that all intended application references are enforced by the database.'
]
formatted = ''
for item in doc:
    separator = '\n' if item.startswith('|') and formatted.rstrip().endswith('|') else '\n\n'
    formatted += (separator if formatted else '') + item
(ROOT/'md/Updated Chapter 3 ERD.md').write_text(formatted+'\n',encoding='utf-8')
print(f'Generated ERD: {len(included)} included, {len(excluded)} excluded, {len(relations)} relationships, 5 module sheets.')
from chapter3_erd_singlepage import build
build(globals())
