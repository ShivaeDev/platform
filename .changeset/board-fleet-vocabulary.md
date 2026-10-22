---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Breaking

- Board and Fleet share four document kinds, five authored states, canonical owners, approval and deliverable fields, question scope and urgency, and six Fleet stages. Run `work-board migrate <board dir>` before starting the new version. Old vocabulary is rejected without aliases. Fleet upgrades stored stages through its database migrations. Consumers of detailed engine states use `record.step`; `record.stage` now contains the shared stage.
- Migration validates all files before writing, reports unmappable values, preserves Fleet questions and recorded answers, retains Marvin as the maintainer, and links named replacements while listing unresolved successors.
- Fleet ask status follows its open or closed attention state, including when earlier revisions have answers. Selection-only answers survive migration. YAML scalar styles and JSON frontmatter stay intact. Closing or acknowledging a Fleet ask marks its question done.
