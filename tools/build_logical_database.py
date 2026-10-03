"""Generate the logical database figure and dictionary without modifying the ERD."""
from pathlib import Path
import ast
import json
from chapter3_erd_singlepage import build

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'md' / 'erd'
schema = json.loads((ROOT/'md/Logical Database Schema Snapshot.json').read_text())
tables = schema['tables']
source = ast.parse((ROOT/'tools/build_chapter3_erd.py').read_text(encoding='utf-8'))
def literal(name):
    return next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign)
                and any(isinstance(t,ast.Name) and t.id==name for t in n.targets)
                and isinstance(n.value,(ast.Dict,ast.List)))
reasons = literal('reasons')
excluded = literal('excluded')
included = sorted(reasons)
assert set(included)|set(excluded)==set(tables)
relations=[]
for child in included:
    for fk in tables[child]['foreign_keys']:
        parent,col,pc=fk['REFERENCED_TABLE_NAME'],fk['COLUMN_NAME'],fk['REFERENCED_COLUMN_NAME']
        if parent not in included or fk['CONSTRAINT_NAME'] in ('fk_org_members_org_role','fk_inventory_org_category'):continue
        column=next(c for c in tables[child]['columns'] if c['COLUMN_NAME']==col)
        indexes=tables[child]['indexes']
        names={i['INDEX_NAME'] for i in indexes if i['NON_UNIQUE']==0}
        one=any([i['COLUMN_NAME'] for i in indexes if i['INDEX_NAME']==name]==[col] for name in names)
        relations.append((parent,child,col,pc,column['IS_NULLABLE']=='YES',one,'DB'))
for r in literal('logical'):
    assert any(c['COLUMN_NAME']==r[2] for c in tables[r[1]]['columns'])
    declared=any(f['COLUMN_NAME']==r[2] and f['REFERENCED_TABLE_NAME']==r[0] for f in tables[r[1]]['foreign_keys'])
    if not declared: relations.append((*r,'APP'))

fields={t:[c['COLUMN_NAME'] for c in tables[t]['columns']] for t in included}
def tags(table,name):
    column=next(c for c in tables[table]['columns'] if c['COLUMN_NAME']==name)
    result=[]
    if column['COLUMN_KEY']=='PRI':result.append('PK')
    if any(f['COLUMN_NAME']==name for f in tables[table]['foreign_keys']):result.append('FK')
    elif any(r[1]==table and r[2]==name for r in relations):result.append('REF')
    if column['IS_NULLABLE']=='YES':result.append('NULL')
    return ', '.join(result)

def logical_type(value):
    if value=='tinyint(1)':return 'boolean'
    if value.startswith('enum('):return 'enum'
    if value.startswith(('int(','bigint(','smallint(')):return value.split('(')[0]
    return value

selected = build(globals(),logical=True)

mermaid=['erDiagram','    direction LR']
for t in included:
    mermaid.append('    '+t+' {')
    for c in tables[t]['columns']:
        typ=logical_type(c['COLUMN_TYPE']).replace(' ','_')
        name=c['COLUMN_NAME'];tag=tags(t,name)
        key=' PK' if 'PK' in tag else (' FK' if 'FK' in tag else '')
        comment=(' "'+tag+'"') if tag else ''
        mermaid.append(f'        {typ} {name}{key}{comment}')
    mermaid.append('    }')
# One line per ordered table pair; multiple actor references stay in the dictionary.
seen=set()
for p,c,col,pc,opt,one,kind in selected:
    if (p,c) in seen:continue
    seen.add((p,c))
    mermaid.append(f'    {p} {"|o" if opt else "||"}{".." if kind=="APP" else "--"}{"o|" if one else "o{"} {c} : "{col}"')
(OUT/'logical-database.mmd').write_text('\n'.join(mermaid)+'\n',encoding='utf-8')

dictionary=['# AISERS Logical Database Data Dictionary','',
 '**Source:** read-only metadata inspection of local `capstone_db`, 03 October 2026. The figure contains all 284 attributes of the same 23 business tables selected for the updated ERD. The other 10 support tables are outside this diagram’s scope.','',
 'The figure uses MySQL/MariaDB-compatible logical types: `tinyint(1)` is displayed as `boolean`; integer display widths such as `int(11)` are omitted; enums are displayed as `enum`. Exact stored types, including enum choices, are listed below. The old SQL Server types (`bit`, `datetime2`, `varchar(MAX)`, `varbinary(MAX)`) are replaced with types corresponding to the actual local database. File/image paths are not binary image columns.','',
 '**PK** = primary key; **FK** = declared database foreign key; **REF** = application reference without a declared FK. Nullable and unique constraints are documented here to keep the one-page figure compact.','',
 'Only one connector is drawn per pair of tables. Where several columns reference the same table, the connector’s cardinality represents the principal reference, not every secondary reference. For example, the submission/version connector represents `submission_id`; `root_submission_id` and `parent_submission_id` have distinct revision-lineage constraints.','',
 '## Corrections to the old diagram','',
 '- `inventory_items` contains item names, barcodes, category IDs, availability, equipment rates, overtime rates, and locker rates. Item names and barcodes are strings; category IDs are integers. Payment status, payment method, and total cost are not inventory-item columns.','- `rentals` contains transaction cost and payment status, service kind, locker periods, and notice information. `payment_method` is absent from the inspected table.','- Document submissions include actual `academic_year` and `updated_at` fields; unnamed `Field` placeholders in the old image are replaced with real column names.','- Four entities are added: `announcement_program_targets`, `document_versions`, `document_decisions`, and `print_jobs`.','- Account and roster values remain separate. `users.year_section` is not present in the inspected database; `student_numbers.year_section` is present.','- Actual presence/absence of foreign keys is respected. Application references are marked REF instead of being mislabeled as enforced FKs.','']
for t in included:
    dictionary.extend([f'## {t}','',reasons[t],'','| Attribute | Logical type | Exact database type | Keys/reference | Nullable |','| --- | --- | --- | --- | --- |'])
    for c in tables[t]['columns']:
        name=c['COLUMN_NAME']
        dictionary.append(f'| `{name}` | `{logical_type(c["COLUMN_TYPE"])}` | `{c["COLUMN_TYPE"]}` | {tags(t,name).replace(", NULL", "").replace("NULL", "") or "—"} | {c["IS_NULLABLE"]} |')
    dictionary.extend(['','Unique constraints:'])
    names={i['INDEX_NAME'] for i in tables[t]['indexes'] if i['NON_UNIQUE']==0}
    for name in sorted(names):
        cols=[i['COLUMN_NAME'] for i in tables[t]['indexes'] if i['INDEX_NAME']==name]
        dictionary.append(f'- `{name}`: '+', '.join('`'+c+'`' for c in cols))
    refs=[r for r in relations if r[1]==t]
    if refs:
        dictionary.extend(['','References:'])
        for p,child,col,pc,opt,one,kind in refs:
            dictionary.append(f'- `{col}` → `{p}.{pc}` ({kind}; '+('nullable' if opt else 'required')+').')
    composite={}
    for fk in tables[t]['foreign_keys']:
        composite.setdefault(fk['CONSTRAINT_NAME'],[]).append(fk)
    for name,items in composite.items():
        if len(items)>1:
            dictionary.append(f'- Composite `{name}`: (`'+ '`, `'.join(i['COLUMN_NAME'] for i in items)+'`) → `'+items[0]['REFERENCED_TABLE_NAME']+'` (`'+'`, `'.join(i['REFERENCED_COLUMN_NAME'] for i in items)+'`).')
    dictionary.append('')
(ROOT/'md/Updated Logical Database Design.md').write_text('\n'.join(dictionary),encoding='utf-8')

summary='''# AISERS Logical Database Design

The updated logical database diagram shows the same **23 business tables** as the Chapter 3 ERD, with **all 284 attributes**, data types, and key markings. It is one connected diagram on one page, with each table shown once and one connector per pair of related tables. The schema was verified through read-only metadata queries against the local `capstone_db` on 03 October 2026.

- [Single-page PDF](md/erd/logical-database.pdf)
- [SVG diagram](md/erd/logical-database-single-page.svg)
- [PNG for Word](md/erd/logical-database-single-page.png)
- [Browser preview and printing](md/erd/logical-database.html)
- [Editable Mermaid source](md/erd/logical-database.mmd)
- [Full data dictionary, constraints, and corrections](md/Updated%20Logical%20Database%20Design.md)
- [Metadata snapshot](md/Logical%20Database%20Schema%20Snapshot.json)

The PDF uses A3 landscape to retain the detailed attributes on one page. The scalable SVG can be inserted into a document and rotated or resized to suit the Chapter 3 page format.

**Notation:** PK = primary key; FK = declared database foreign key; REF = application reference. Solid connectors are declared FKs; dashed connectors are application references. Crow’s feet represent many, circles optional participation, and bars one. A combined table-pair connector represents the principal key relationship; additional references and their constraints are explained in the dictionary.

Unlike the old diagram, data types follow the current local MySQL/MariaDB schema rather than SQL Server notation. The full dictionary preserves exact enum values and nullability; integer display widths are omitted and tinyint(1) is displayed as boolean in the figure.

![AISERS Logical Database Design](md/erd/logical-database-single-page.svg)
'''
(ROOT/'LOGICAL DESIGN.md').write_text(summary,encoding='utf-8')
print('Logical design document, editable source, and complete data dictionary updated.')
