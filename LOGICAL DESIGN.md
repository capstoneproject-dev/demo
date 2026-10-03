# AISERS Logical Database Design

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
