"""Single connected Chapter 3 figure, using the verified ERD metadata."""
from html import escape
import heapq
import math
import xml.etree.ElementTree as ET


def build(context, logical=False):
    out = context['OUT']
    root = context['ROOT']
    fields = context['fields']
    tags = context['tags']
    relations = context['relations']
    if logical:
        fields = {t: [c['COLUMN_NAME'] for c in context['tables'][t]['columns']]
                  for t in context['included']}
    pos = {
        'institutes': (0, 0), 'academic_programs': (1, 0),
        'program_org_mappings': (2, 0), 'announcement_program_targets': (3, 0),
        'announcements': (4, 0), 'student_numbers': (0, 1),
        'events': (1, 1), 'organization_members': (2, 1),
        'org_roles': (3, 1), 'inventory_categories': (4, 1),
        'pending_registrations': (0, 2), 'users': (1, 2),
        'organizations': (2, 2), 'rentals': (3, 2),
        'inventory_items': (4, 2), 'attendance_records': (0, 3),
        'document_submissions': (2, 3), 'document_versions': (3, 3),
        'rental_items': (4, 3), 'document_annotations': (1, 4),
        'document_decisions': (2, 4), 'documents_approved': (3, 4),
        'print_jobs': (4, 4),
    }
    assert set(pos) == set(context['included'])
    # Show principal associations once. Secondary actor references remain in the
    # complete catalog, rather than adding redundant lines to the thesis figure.
    actor_pairs = {
        ('users', 'organization_members'): 'user_id',
        ('users', 'attendance_records'): 'user_id',
        ('users', 'rentals'): 'renter_user_id',
        ('users', 'print_jobs'): 'user_id',
        ('users', 'document_submissions'): 'submitted_by_user_id',
    }
    selected = []
    pairs = set()
    for r in relations:
        p, c, col, *_ = r
        if p == 'users' and actor_pairs.get((p, c), col if logical else None) != col:
            continue
        if p == 'document_submissions' and c == 'document_versions' and col != 'submission_id':
            continue
        if (p,c) not in pairs:
            selected.append(r)
            pairs.add((p,c))
    width,height = (3540,2500) if logical else (2120,1500)
    if logical:
        row_tops = [85]
        for row in range(4):
            tallest = max(53+18*len(fields[t]) for t,(_,r) in pos.items() if r==row)
            row_tops.append(row_tops[-1]+tallest+80)
        boxes = {t: (40+col*700,row_tops[row],620,53+18*len(fields[t]))
                 for t,(col,row) in pos.items()}
    else:
        boxes = {t: (40 + col*420, 85 + row*260, 340, 53 + 21*len(fields[t]))
                 for t, (col, row) in pos.items()}
    bottom=max(y+h for x,y,w,h in boxes.values())
    assert bottom<height-90
    ports = {}
    endpoints = []
    for i, r in enumerate(selected):
        p, c = r[:2]
        x,y,w,h=boxes[p]; xx,yy,ww,hh=boxes[c]
        if abs(pos[p][0]-pos[c][0]) >= abs(pos[p][1]-pos[c][1]) and x != xx:
            side_a,side_b=('R','L') if xx>x else ('L','R')
        else:
            side_a,side_b=('B','T') if yy>y else ('T','B')
        endpoints.append((side_a,side_b))
        ports.setdefault((p,side_a),[]).append((i,0,yy+hh/2 if side_a in 'LR' else xx+ww/2))
        ports.setdefault((c,side_b),[]).append((i,1,y+h/2 if side_b in 'LR' else x+w/2))
    anchors={}
    for (t,side),values in ports.items():
        x,y,w,h=boxes[t]
        for j,(i,end,_) in enumerate(sorted(values,key=lambda v:v[2])):
            fraction=(j+1)/(len(values)+1)
            if side in 'LR': point=(x if side=='L' else x+w,y+43+(h-55)*fraction)
            else: point=(x+20+(w-40)*fraction,y if side=='T' else y+h)
            anchors[i,end]=point
    used_segments=[]

    def route(a,b,side_a,side_b,i):
        delta={'L':(-1,0),'R':(1,0),'T':(0,-1),'B':(0,1)}
        da,db=delta[side_a],delta[side_b]
        offset=25+i%4*3
        aa=(a[0]+da[0]*offset,a[1]+da[1]*offset)
        bb=(b[0]+db[0]*offset,b[1]+db[1]*offset)
        xs=sorted({18,width-18,aa[0],bb[0]} | {v for x,y,w,h in boxes.values() for v in (x-offset,x+w+offset)})
        ys=sorted({62,bottom+35,aa[1],bb[1]} | {v for x,y,w,h in boxes.values() for v in (y-offset,y+h+offset)})

        def clear(u,v):
            for x,y,w,h in boxes.values():
                if u[0]==v[0]:
                    if x-5<u[0]<x+w+5 and max(min(u[1],v[1]),y-5)<min(max(u[1],v[1]),y+h+5): return False
                elif y-5<u[1]<y+h+5 and max(min(u[0],v[0]),x-5)<min(max(u[0],v[0]),x+w+5): return False
            return True

        def congestion(u,v):
            penalty=0
            for s,t in used_segments:
                if u[0]==v[0]==s[0]==t[0]:
                    penalty+=max(0,min(max(u[1],v[1]),max(s[1],t[1]))-max(min(u[1],v[1]),min(s[1],t[1])))*2
                elif u[1]==v[1]==s[1]==t[1]:
                    penalty+=max(0,min(max(u[0],v[0]),max(s[0],t[0]))-max(min(u[0],v[0]),min(s[0],t[0])))*2
            return penalty

        start=(xs.index(aa[0]),ys.index(aa[1]),-1)
        todo=[(0,start)];costs={start:0};previous={};goal=None
        while todo:
            cost,u=heapq.heappop(todo)
            if cost!=costs[u]: continue
            if (xs[u[0]],ys[u[1]])==bb: goal=u;break
            for dx,dy,axis in ((1,0,0),(-1,0,0),(0,1,1),(0,-1,1)):
                v=(u[0]+dx,u[1]+dy,axis)
                if not(0<=v[0]<len(xs) and 0<=v[1]<len(ys)): continue
                up=(xs[u[0]],ys[u[1]]);vp=(xs[v[0]],ys[v[1]])
                if not clear(up,vp): continue
                new=cost+abs(up[0]-vp[0])+abs(up[1]-vp[1])+congestion(up,vp)+(16 if u[2]!=axis else 0)
                if new<costs.get(v,float('inf')):
                    costs[v]=new;previous[v]=u;heapq.heappush(todo,(new,v))
        assert goal is not None,(a,b)
        points=[];u=goal
        while u!=start: points.append((xs[u[0]],ys[u[1]]));u=previous[u]
        points.append(aa);points.reverse();points=[a]+points+[b]
        reduced=[points[0]]
        for j in range(1,len(points)-1):
            if not(points[j-1][0]==points[j][0]==points[j+1][0] or points[j-1][1]==points[j][1]==points[j+1][1]): reduced.append(points[j])
        reduced.append(points[-1]);used_segments.extend(zip(reduced,reduced[1:]))
        return reduced

    verbs = {
        ('institutes','academic_programs'):'has', ('institutes','student_numbers'):'lists',
        ('institutes','users'):'affiliates', ('academic_programs','student_numbers'):'lists',
        ('academic_programs','users'):'enrolls', ('student_numbers','users'):'identifies',
        ('student_numbers','pending_registrations'):'validates',
        ('academic_programs','program_org_mappings'):'maps', ('organizations','program_org_mappings'):'maps',
        ('academic_programs','announcement_program_targets'):'targets',
        ('announcements','announcement_program_targets'):'has targets',
        ('organizations','announcements'):'publishes', ('organizations','org_roles'):'defines',
        ('organizations','organization_members'):'has', ('org_roles','organization_members'):'assigns',
        ('users','organization_members'):'joins', ('organizations','events'):'hosts',
        ('events','attendance_records'):'records', ('users','attendance_records'):'attends',
        ('organizations','document_submissions'):'submits', ('users','document_submissions'):'uploads',
        ('document_submissions','document_annotations'):'annotated',
        ('document_submissions','document_decisions'):'reviewed',
        ('document_submissions','document_versions'):'versioned',
        ('document_submissions','documents_approved'):'approved',
        ('organizations','documents_approved'):'archives',
        ('organizations','inventory_categories'):'defines', ('organizations','inventory_items'):'owns',
        ('inventory_categories','inventory_items'):'categorizes',
        ('organizations','rentals'):'manages', ('users','rentals'):'rents',
        ('rentals','rental_items'):'contains', ('inventory_items','rental_items'):'included',
        ('users','print_jobs'):'requests', ('organizations','print_jobs'):'prints',
    }
    title='AISERS Logical Database Design' if logical else 'AISERS Entity Relationship Diagram'
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{title}">',
           '<style>text{font-family:Arial,sans-serif;fill:#182d43}.edge{fill:none;stroke:#4b5f70;stroke-width:1.7}.app{stroke-dasharray:6 4}.symbol{fill:white;stroke:#263d50;stroke-width:1.8}</style>',
           f'<rect width="{width}" height="{height}" fill="white"/>',
           f'<text x="{width/2}" y="35" text-anchor="middle" font-size="27" font-weight="bold">{title}</text>']
    glyphs=[];labels=[];label_boxes=[]
    for i,r in enumerate(selected):
        p,c,col,pc,opt,one,kind=r
        points=route(anchors[i,0],anchors[i,1],*endpoints[i],i)
        path='M '+' L '.join(f'{x:.2f} {y:.2f}' for x,y in points)
        parts.append(f'<path class="edge {"app" if kind=="APP" else ""}" data-parent="{p}" data-child="{c}" d="{path}"/>')
        for anchor,next_point,is_parent in ((points[0],points[1],True),(points[-1],points[-2],False)):
            angle=math.degrees(math.atan2(next_point[1]-anchor[1],next_point[0]-anchor[0]))
            glyph=f'<g transform="translate({anchor[0]},{anchor[1]}) rotate({angle})" class="symbol">'
            if is_parent or one:
                glyph+='<path d="M 7 -6 V 6"/>'
                optional=opt if is_parent else True
                glyph+='<circle cx="20" cy="0" r="4"/>' if optional else '<path d="M 15 -6 V 6"/>'
            else:
                glyph+='<path d="M 2 -6 L 14 0 L 2 6 M 2 0 H 14"/><circle cx="24" cy="0" r="4"/>'
            glyphs.append(glyph+'</g>')
        if logical:
            continue
        label=verbs.get((p,c),'has')
        lw=len(label)*7.5+14;lh=20
        candidates=[]
        for u,v in zip(points,points[1:]):
            length=abs(u[0]-v[0])+abs(u[1]-v[1])
            for f in (.5,.33,.67,.2,.8):
                tx=u[0]+(v[0]-u[0])*f;ty=u[1]+(v[1]-u[1])*f
                rect=(tx-lw/2,ty-lh/2,lw,lh)
                rx,ry,rw,rh=rect
                if length<(lw+45 if u[1]==v[1] else 65):continue
                if any(rx<x+w+8 and rx+rw>x-8 and ry<y+h+8 and ry+rh>y-8 for x,y,w,h in boxes.values()):continue
                if any(rx<x+w+5 and rx+rw>x-5 and ry<y+h+5 and ry+rh>y-5 for x,y,w,h in label_boxes):continue
                candidates.append((length-abs(f-.5)*30,tx,ty,rect))
        if candidates:
            _,tx,ty,rect=max(candidates);label_boxes.append(rect)
            labels.append(f'<rect x="{rect[0]}" y="{rect[1]}" width="{lw}" height="{lh}" fill="white"/><text x="{tx}" y="{ty+5}" text-anchor="middle" font-size="15">{escape(label)}</text>')
    parts+=glyphs
    for t,(x,y,w,h) in boxes.items():
        parts += [f'<g data-entity="{t}"><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="#8299ac" stroke-width="1.5"/>',
                  f'<rect x="{x}" y="{y}" width="{w}" height="34" fill="#79b3ed"/>',
                  f'<text x="{x+10}" y="{y+24}" font-size="20" font-weight="bold">{t}</text>']
        for j,col in enumerate(fields[t]):
            tag=tags(t,col).replace(', NULL','').replace('NULL','')
            suffix=f'  [{tag}]' if tag else ''
            line_y=y+54+j*(18 if logical else 21)
            parts.append(f'<text data-column="{col}" x="{x+10}" y="{line_y}" font-size="{15 if logical else 17}">{escape(col+suffix)}</text>')
            if logical:
                column=next(c for c in context['tables'][t]['columns'] if c['COLUMN_NAME']==col)
                datatype=column['COLUMN_TYPE']
                if datatype=='tinyint(1)': datatype='boolean'
                elif datatype.startswith('enum('): datatype='enum'
                elif datatype.startswith(('int(','bigint(','smallint(')): datatype=datatype.split('(')[0]
                parts.append(f'<text x="{x+440}" y="{line_y}" font-size="15">{escape(datatype)}</text>')
        if logical:
            parts.append(f'<path d="M {x+430} {y+34} V {y+h}" stroke="#c4ced8" stroke-width="1"/>')
        parts.append('</g>')
    parts+=labels
    parts += [
        f'<text x="{width/2}" y="{height-77}" text-anchor="middle" font-size="18">PK = primary key · FK = declared foreign key · REF = application reference · solid = database FK · dashed = application reference</text>',
        f'<text x="{width/2}" y="{height-49}" text-anchor="middle" font-size="18">Crow’s foot = many · circle = optional (zero) · bar = one · {(str(len(fields))+" business tables, all "+str(sum(map(len,fields.values())))+" attributes; enum values and nullability in the data dictionary") if logical else "selected core attributes and relationships"}</text>',
        f'<text x="{width/2}" y="{height-19}" text-anchor="middle" font-size="23" font-weight="bold">{"Logical Database Design" if logical else "Figure 8. Entity Relationship Diagram"}</text>', '</svg>']
    svg='\n'.join(parts)
    parsed=ET.fromstring(svg)
    assert len(parsed.findall('.//{http://www.w3.org/2000/svg}g[@data-entity]'))==23
    if logical:
        (out/'logical-database-single-page.svg').write_text(svg,encoding='utf-8')
        html='''<!doctype html><html lang="en"><meta charset="utf-8"><title>AISERS Logical Database Design</title>
<style>body{margin:0;background:white}img{display:block;width:100%;height:auto}header{padding:12px;font:16px Arial}a{margin-right:20px}@page{size:A3 landscape;margin:6mm}@media print{header{display:none}img{width:408mm;height:284mm;object-fit:contain}}</style>
<header><a href="logical-database.pdf">Single-page PDF</a><a href="logical-database-single-page.svg">SVG</a><a href="logical-database-single-page.png">PNG for Word</a><button onclick="window.print()">Print / Save as PDF</button></header>
<img src="logical-database-single-page.svg" alt="AISERS logical database design, 23 unique tables with data types"></html>'''
        (out/'logical-database.html').write_text(html,encoding='utf-8')
        print(f'Logical database figure generated: 23 tables, {sum(map(len,fields.values()))} attributes, {len(selected)} distinct table-pair connectors.')
        return selected
    (out/'chapter-3-erd-overview.svg').write_text(svg,encoding='utf-8')
    (out/'chapter-3-erd-single-page.svg').write_text(svg,encoding='utf-8')
    (out/'chapter-3-erd-single-page.mmd').write_text(context['mermaid'](list(pos),selected),encoding='utf-8')
    html='''<!doctype html><html lang="en"><meta charset="utf-8"><title>AISERS Single-Page ERD</title>
<style>body{margin:0;background:white}img{display:block;width:100%;height:auto}header{padding:12px;font:16px Arial}a{margin-right:20px}@page{size:A4 landscape;margin:6mm}@media print{header{display:none}img{width:285mm;height:197mm;object-fit:contain}}</style>
<header><a href="chapter-3-erd.pdf">Single-page PDF</a><a href="chapter-3-erd-single-page.svg">SVG</a><a href="chapter-3-erd-single-page.png">PNG for Word</a><button onclick="window.print()">Print / Save as PDF</button></header>
<img src="chapter-3-erd-single-page.svg" alt="AISERS entity relationship diagram, 23 unique tables"></html>'''
    (out/'index.html').write_text(html,encoding='utf-8')
    doc_path=root/'md/Updated Chapter 3 ERD.md'
    doc=doc_path.read_text(encoding='utf-8')
    doc=doc.replace('organized into the five readable module figures below','presented as one connected figure with each of the 23 selected tables shown once')
    doc=doc.replace('Download the five-page PDF','Download the single-page PDF').replace('printable Chapter 3 figures','one landscape A4 Chapter 3 figure')
    doc=doc.replace('Open the printable five-sheet diagram','Open the printable single-page diagram')
    old='The SVG uses numbered connections with explicit multiplicities in the relationship key. This keeps long table and foreign-key names readable. Shared table boxes repeat across sheets and refer to one entity, not extra tables. Secondary actor references (archiving, forwarding, cancellation, notices, and similar fields) are retained in the complete Mermaid source and relationship catalog rather than every module figure. Selected business attributes are shown; the snapshot contains the full column inventory.'
    new='The primary PDF and SVG now contain **one connected ERD on one page**, with all **23 tables shown exactly once**. Blue table headers, relationship verbs, and crow’s foot cardinalities follow the style of the old figure. The principal associations are illustrated; secondary user-actor references and document root/parent lineage are retained in the complete Mermaid source and relationship catalog. Selected attributes fit the figure; the snapshot contains the full column inventory. [PNG for Word](erd/chapter-3-erd-single-page.png) and [editable single-page source](erd/chapter-3-erd-single-page.mmd) are also provided. Earlier module sheets remain supplementary references.'
    doc=doc.replace(old,new)
    doc=doc.replace('## Module figures','## Supplementary module figures')
    doc=doc.replace('Suggested captions: **Figure 8. AISERS Entity Relationship Diagram**, using the overview, or **Figures 8a–8e. AISERS Entity Relationship Diagram by Module**, using the readable sheets. Adjust numbering to match the thesis.','Suggested caption: **Figure 8. Entity Relationship Diagram**. Adjust numbering to match the thesis.')
    doc_path.write_text(doc,encoding='utf-8')
    print(f'Single-page ERD generated: 23 unique tables, {len(selected)} principal relationships.')
