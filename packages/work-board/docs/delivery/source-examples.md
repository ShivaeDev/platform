# Optional source structure

Work Board reads optional YAML frontmatter at the beginning of a Markdown file. The file remains authoritative; the in-memory identity/search index is rebuilt from readable files and invalidated by the watcher. No database, generated source files, cloud service, or migration is required. Parsing uses `yaml` and Effect Schema. The UI reads this structure and never rewrites it.

## Heading boards

```markdown
# Navigation delivery

## In progress

### Search the workspace

Find document titles, headings, and passages.

## In review

### Remember reading state

Evidence: [navigation review](../evidence/review.md).
```

Heading boards need no metadata. Section names are presentation, never inferred workflow transitions. An unannotated card has no durable identity, owner, acceptance decision, or machine-readable status. Its passage URL can change when its heading changes. Richer identity uses one file per item.

## A richer item

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

Use deterministic local matching first. Keep Markdown authoritative.
```

Every top-level field is optional. Missing values stay blank in work details. `owner` records responsibility, without claiming authorship. `status` and `next_action` are explicit source text, and no transition rules are inferred. Now, Today and goal pages read the `status` of tasks and of items that implement a goal through one work vocabulary: `planned`, `received` and `ready` are planned; `approved` and `prepared` are queued; `active`, `running`, `in-progress`, `in progress`, `agent-working`, `executing` and `adopting` are executing; `review`, `in-review`, `in review`, `reviewing`, `repairing` and `validating` are reviewing; `delivering` is delivering; `blocked` and `waiting-on-person` wait on a person; `needs-human` and `needs-you` need you; `deferred` is deferred; and `done`, `closed`, `dropped`, `superseded`, `completed`, `cancelled`, `canceled`, `resolved` and `released` are closed. Case and surrounding spaces do not matter, and a missing status is planned. A work status outside this vocabulary is listed on System as a file problem: Now leaves the item out and its goal page counts it as planned.

| Field | Source shape |
| --- | --- |
| `id` | Workspace-local, case-sensitive ID: ASCII letter/digit first, then letters/digits, `.`, `_`, or `-` |
| `kind` | `task`, `investigation`, `decision`, `result`, `project`, `board`, `goal`, `report`, `question`, `response`, or `handoff` |
| `status`, `owner`, `next_action` | Nonblank strings |
| `criteria` | List of `{ id, text }`; criterion IDs use the item ID syntax and are unique within the file |
| `relationships` | List of `{ kind, target }`; kind is `implements`, `informs`, `depends_on`, or `relates_to`; target is an item ID or `item.id#criterion-id` |
| `items` | Explicit list of item IDs declaring board membership, independent of status or section headings |
| `areas` | List of nonblank area labels; Board checks the shape and Fleet reads it for area claims |
| `evidence` | List of records described below |
| `attention` | List of explicit request records; [shapes and reading rules](./attention-examples.md) |
| `options` | List of at most 32 `{ label, description }` records with unique nonblank labels of at most 128 characters and nonblank descriptions of at most 8192 characters; on a `question` or `decision` item they form one single-choice prompt and cannot be combined with question directives |
| `recommended` | The label of one `options` entry, marked **Recommended** on the answer card and on Today |
| `question`, `response` | Optional dedicated record provenance; [anchored response contract](./response-write-examples.md) |
| `handoff` | Optional direction/source snapshot and explicit receipt; [ordinary-file handoff contract](./handoff-examples.md) |
| `request_receipt` | Optional immutable acknowledgement of an exact managed decision request; [response and acknowledgement rules](../../README.md#record-a-human-response) |

Fleet's add-on fields `fleet`, `fleet-launch`, `fleet-deliverable` and `fleet-priority` are accepted without a diagnostic; Board leaves them uninterpreted and Fleet reads them.

A unique ID resolves at `/_board/item/work.search/`. This URL survives file and heading renames while the ID remains unchanged and unique. A criterion resolves at `/_board/item/work.search/#criterion-keyboard`. File and generated heading URLs work alongside it; pinned and recent documents refer to file paths.

Search includes declared ID, kind, status, owner, next action, and criteria. Results show source lines where known; criterion results open and focus the criterion's work-details context. Source diagnostics identify file/line, and **Original frontmatter** exposes the retained header.

## Relationships and board declarations

```markdown
---
id: decision.search-matching
kind: decision
status: proposed
relationships:
  - kind: informs
    target: work.search
---
# Deterministic matching

Option A: token matching with deterministic ranking.
Option B: fuzzy ranking with additional tuning.

Recommendation: A. A person's acceptance remains a separate decision.
```

```yaml
id: board.navigation
kind: board
items: [work.search, work.reading-state]
```

Relationships and membership resolve only against explicit IDs. They are shown as readable links; unresolved or ambiguous targets stay visible with diagnostics. These declarations do not turn a section name into a workflow rule.

## Criterion-level recorded evidence

Each record requires a nonblank `source`. All other evidence fields are optional: `criterion` names an item or criterion reference; `checked_revision` is a full 40- or 64-digit hexadecimal Git revision; `observed_at` is a parseable ISO timestamp with a timezone; `method` and `outcome` are nonblank strings.

```yaml
evidence:
  - source: ../evidence/browser-walkthrough.md
    criterion: work.search#keyboard
    method: real Chromium walkthrough
    outcome: passed
```

This example deliberately has no revision or observation time; they remain blank. Supply real values when available. Relative source links resolve from the file containing the record. HTTP(S) sources are ordinary links; executable URL schemes stay plain text. Local image sources use the contained PNG/JPEG/GIF/WebP attachment route described in the README; other non-Markdown assets are not served.

Records appear under **Recorded evidence**, whose tooltip states that source claims are not independently verified. A recorded outcome, test link, agent run completion, or proposed decision does not establish verified acceptance. Work Board neither runs checks nor verifies freshness here.

## Invalid, unknown, and unavailable sources

- A header opens with `---` on the first line, optionally after a BOM, and closes with a separate `---` line. CRLF is supported. Scalar/list headers and unclosed headers retain the original Markdown and show a diagnostic.
- YAML syntax errors, duplicate keys, unsupported tags, or excessive alias expansion leave the header uninterpreted and retain readable body prose.
- Unknown top-level fields other than Fleet's add-on fields stay in the original header with a diagnostic. An invalid known field, including unknown nested keys, stays uninterpreted as a whole. Independent valid fields render. No source bytes are rewritten.
- Duplicate IDs show all matching source files and a conflict page; no winner is chosen. Duplicate criterion IDs do not receive selectable criterion links.
- Missing IDs/criteria remain unresolved. Removing the source yields an explicit missing-item page. Removing or changing its ID does not preserve that identity.
- If any listed file cannot be read, identity links report an incomplete index rather than asserting uniqueness. Readable documents and partial search remain usable; reference validation waits for a complete index.

## Reading the reasoning and recorded claims

Decision options, comparison tables, and rationale remain body Markdown. A result can declare `kind: implements` with `target: plan.search` in a relationship record; that plan can declare an `implements` relationship to `decision.search`. The reader reaches its rationale in two links without adding decision-specific frontmatter fields.

Criteria list claims from all readable files that explicitly name their unique item/criterion reference. Claim counts are not acceptance counts. Records expose origin file/line and supplied provenance; old checked revisions remain visible without a comparison to current Git state. Missing/ambiguous criteria or an incomplete index prevent association rather than selecting a winner. Record anchors use their array position and can change on insertion/reordering.

Source backlinks also include explicit Markdown hyperlinks and evidence-source paths, resolved relative to each source file, with `/` mapped to the configured home or first file. Code examples, external URLs, and self references are excluded. Plain files can show incoming links without acquiring an ID or inferred work kind. Evidence associations retain source links; image inspection follows the local attachment boundary described in the README.

Questionnaire responses may additionally record `response.answers` entries with `prompt`, `selected` option IDs and human `text`, plus an optional `response.supersedes` identity. These fields are optional; plain responses remain valid. See the [packet contract and complete source example](./decision-write-examples.md) for validation, reviewed-context binding and human selection semantics.
