# D1 review: optional source structure

These are proposed plain-text examples for the discussion gate before step 04.
They are not supported metadata syntax or an adopted API. Steps 01–03 read normal
Markdown and do not interpret these fields. The maintainer must choose the source
convention before implementation. No schema or dependency has been adopted; no
migration is required by this proposal.

## Existing heading board stays useful

```markdown
# Navigation delivery

## In progress

### Search the workspace

Find document titles, headings, and passages. Verify keyboard focus and missing
results against the large fixture.

## In review

### Remember reading state

Evidence: [navigation PR](https://github.com/ShivaeDev/platform/pull/77).
```

This remains the current format. Its section names are presentation, not inferred
workflow transitions. An unannotated card has no durable identity, owner,
acceptance decision, or machine-readable status. Renaming a heading can change
its passage URL. The richer model must not invent missing fields.

## A richer item as one readable file

Working recommendation: optional YAML frontmatter in a Markdown file, with an
explicit project-local ID. One file can represent a richer item while existing
heading boards remain readable. The exact keys, YAML support, and how existing
cards opt into identity are decisions for D1, not implementation promises.

```markdown
---
id: work.search
kind: task
status: in-review
owner: agent-navigation
next_action: Review keyboard and mobile evidence
criteria:
  - id: keyboard
    text: Escape returns focus to the opening control
  - id: passage
    text: A search result reaches the second duplicate heading
relationships:
  - kind: implements
    target: decision.search-matching
---
# Search the workspace

Use deterministic local matching first. Keep plain Markdown authoritative and
let the index be rebuilt from the files. Human review remains distinct from an
agent finishing a run.
```

`owner` identifies responsibility, not who authored every sentence. Status must
be explicitly recorded; a section heading or an agent's claim cannot set it.
Criteria have IDs so evidence can name the precise assertion it supports.

Implementing YAML frontmatter would need a declared YAML parser dependency. The
concrete option for review is `yaml` 2.9.0 (already a transitive dependency in the
repository lockfile), plus Effect Schema validation. Do not implement a partial
handwritten YAML parser. This dependency is proposed only; step 03 adds none.

## A decision linked to revision-specific evidence

```markdown
---
id: decision.search-matching
kind: decision
status: proposed
relationships:
  - kind: informs
    target: work.search
---
# Start with deterministic text matching

Option A: token matching, a bounded result list, and rebuildable local data.
Option B: fuzzy ranking, with more tuning and less predictable results.

Recommendation: A for the first reading workflow. The decision remains proposed
until the person responsible records acceptance.

## Evidence

- Source: [search regression](../../../src/search/entries.test.ts)
- Supports: work.search#passage
- Checked revision: an explicit full Git commit SHA
- Observed time: an explicit ISO timestamp from the checking tool
- Method: real filesystem/HTTP test or named browser walkthrough
```

The example's revision/time placeholders are not evidence. A real record must
supply actual values; missing checks stay unknown. A link to a test or PR alone
does not prove acceptance, freshness, or the criterion's result. We need to agree
whether evidence fields live in structured frontmatter, readable prose, or a
separate explicitly linked document before parsing them.

## Invalid and duplicate cases

- Two files declaring `id: work.search`: show both sources and a duplicate-ID
  diagnostic; do not select a winner or rewrite either file.
- `criteria: keyboard`: malformed under the proposed list shape; render the
  document and show the field diagnostic rather than silently dropping it.
- A relationship targeting `work.missing`: show the unresolved target.
- An unknown field such as `risk_budget`: preserve the source and identify it as
  uninterpreted; do not guess its meaning.
- Evidence checked at an older revision: display its recorded revision and time;
  do not imply the current source was checked.

## Decisions to settle

1. Use optional per-file frontmatter as the first richer-item convention, and
   retain heading boards without requiring migration?
2. Start with ID, kind, explicit status, owner, next action, and typed links; add
   criteria/evidence only where these examples need them?
3. Keep legacy cards without durable IDs initially, and opt into durable
   identity by using a richer per-item file? This avoids an additional inline
   card syntax. Recommend explicit lists of item IDs for richer boards when
   step 05 introduces those views; no inference from section names.
4. Start with structured criterion/evidence records in the richer file, with
   source, checked revision, observation time, method, and recorded outcome?
   Display those as source claims until actually verified. Human acceptance
   stays an explicit separate decision, never inferred from an agent finishing.

Review the actual project notes with steps 01–03 before choosing. D1 approval
settles a source contract; automatic PR merging does not settle these open choices.
