# Step 11 visual document conventions — proposal

Status: awaiting the user's source-format decision. These examples are not an
implemented contract. The existing D1 frontmatter and ordinary Markdown remain
unchanged. Example counts and dates illustrate presentation, not measured progress
or verified acceptance.

Step 11 asks for a fixed vocabulary: callouts, comparisons, metrics, progress and
a simple timeline. Callouts and comparisons can reuse familiar Markdown. Metrics,
progress and timelines need a choice between plain Markdown presentation and an
explicit, small declarative body format. No new dependency or frontmatter field
is proposed; `yaml` and Effect Schema already exist in Work Board.

## Rendering foundation approved by the user

The user requested Antumbra's Markdown/Mermaid tools. Inspecting freshly fetched
Antumbra main `1a5f6ec2444336f2f75339385324304b6bc3bb9a` found
`packages/glass/components/src/markdown-view.tsx` using `react-markdown` 10.1.0
and `remark-gfm` 4.0.1, plus `src/adapters/mermaid.ts` using Mermaid's renderer
with `suppressErrorRendering: true`. Ordinary `mermaid` fences are its diagram
convention. It does not define metric/progress/timeline YAML blocks.

Work Board is adopting the same Markdown/GFM libraries and Mermaid convention.
Use server-side React rendering to preserve readable no-JavaScript pages, existing
heading anchors, source-relative links, footnotes and Shiki highlighting. Preserve
raw-HTML details using `rehype-raw`; Antumbra's client component alone would not
retain Work Board's existing raw-HTML behavior. Keep Work Board's newer installed
Mermaid version, local assets, strict rendering, inspection and source fallback.
Antumbra's external-only link component is unsuitable for local documentation links.
No React client state or second live-update coordinator is introduced.

This rendering choice is approved; the three custom body-block shapes below remain
proposals. Adopting Antumbra's tools does not approve a new authoring schema.

## Shared recommendation: ordinary callouts and comparison tables

Recognize GitHub's five alert markers: NOTE, TIP, IMPORTANT, WARNING and CAUTION.
Unknown markers remain ordinary blockquotes. Preserve the actual text and links.

```markdown
> [!NOTE]
> The native read foundation shipped. Physical device lifecycle checks remain open.

> [!IMPORTANT]
> A recorded browser result does not establish representative-reader acceptance.

| Option | Benefit | Cost | Source |
| --- | --- | --- | --- |
| Keep plain Markdown | Every editor already understands it | Fewer visual affordances | [Source conventions](source-examples.md) |
| Add three explicit blocks | Clear metric/progress/timeline intent | One small authoring format to maintain | [Delivery plan](wave1.md#11-a-small-vocabulary-for-visual-documents) |
```

Comparison tables stay ordinary Markdown, as D1 already specifies. Do not infer
a selected option or a decision from column names, colors or ordering.

## A: Three declarative body blocks (recommended)

Reserve the fenced language `work-board` for exactly three read-only types.
The source remains a readable YAML code block in other editors. Each block names
its source; the renderer records a claim rather than verifying it. Values do not
come from arbitrary statuses, owners or evidence outcomes. Each block requires
nonblank `label` and `source`; a metric also requires a nonblank `unit`. The block
format would be validated with the existing YAML parser and Effect Schema.

### Metric

````markdown
```work-board
type: metric
label: Representative fixture target
value: 50
unit: documents
source: browser-acceptance.md
```
````

Render the label, recorded
value/unit and an ordinary source link. A finite number or explicit `null` is
allowed; `null` displays “Not recorded”. Never treat an absent value as zero.
This is a recorded scalar, with no computed expression, remote fetch or query DSL.

### Progress

````markdown
```work-board
type: progress
label: Example reading checks recorded
completed: 3
total: 8
source: browser-acceptance.md
```
````

Render “Recorded tally: 3 of 8” and a labeled progress bar. Both counts are explicit
nonnegative integers or `null`; a percentage requires a known, positive total and
`completed <= total`. Unknown counts do not become zero or a fabricated percentage.
A 0/0 tally has no percentage. These counts do not establish verified acceptance.
Counts derived from item criteria or evidence are outside this first format.

### Timeline

````markdown
```work-board
type: timeline
label: Reading delivery
entries:
  - when: "2026-10-06 · recorded"
    text: Native live foundation published
    source: ../roadmap.md#step-09-native-adoption-and-orientation-evidence
  - when: "After representative-reader review · planned"
    text: Agree the mutation boundary
    source: wave2.md#14-prove-one-safe-source-mutation
```
````

Render an ordered visual list, retaining source links and a plain text alternative.
`when` is a literal source label: preserve author order rather than inferring dates,
deadlines, scheduling or agent state. Each entry has nonblank `when`, `text` and
`source`; the block has a nonblank label and at least one entry.

### Reading and failure rules

- Recognize only the three types and their declared fields. Unknown types/fields,
  malformed YAML, nonfinite values or invalid progress ratios retain the original
  code block with a local diagnostic. The rest of the document stays readable.
- Escape text, render fixed components and follow existing source-relative link
  rules. Do not evaluate code, load plugins, accept templates or rewrite sources.
- No new D1 frontmatter fields, workflow/acceptance inference or source mutation.
  No implicit derivation of totals from all work, statuses or recorded outcomes.
- Proposed limits: 64 KiB per recognized block and 100 timeline entries. Larger
  inputs remain source code with a clear local diagnostic, rather than partial
  statistics. These limits are part of the proposal, not current behavior.
- Preserve headings, search, native update ownership, reading focus, print/export
  compatibility and the explicit Mark seen baseline. Existing ordinary fences
  remain ordinary code. A source link identifies provenance, not verification.

## B: Plain Markdown only

Use the same callouts/comparison tables above. Keep metrics in a labeled table,
progress in ordinary task lists, and timeline entries in an ordered list:

```markdown
| Recorded measure | Value | Source |
| --- | --- | --- |
| Representative fixture target | 50 documents | [Reading checks](browser-acceptance.md) |
| Representative-reader time | Not recorded | [Reader acceptance](../roadmap.md) |

### Example source checklist

- [x] Native HTTP fixtures
- [x] Chromium reading fixtures
- [ ] Representative-reader orientation

Source: [Reading checks](browser-acceptance.md). Checked boxes are source marks.

### Reading delivery

1. **2026-10-06 · recorded:** [Native foundation](../roadmap.md) published.
2. **After reader review · planned:** [Mutation discussion](wave2.md).
```

Improve typography/layout while keeping those standard structures. This avoids
new structured block inputs; it also defers dedicated scalar cards/progress bars
and explicit timeline semantics. Do not identify every numeric table as a metric
or every dated list as a timeline by guessing from arbitrary prose.

## Decision needed before implementation

Choose A or B, or amend the proposed shapes. Recommendation: A plus the shared
Markdown callouts/comparisons gives the intended visual capabilities with a fixed,
readable vocabulary and explicit provenance. B is a narrower presentation pass.
After the choice, record the agreed shapes/rules here and in source-examples.md,
then implement and validate step 11 against an actual project brief and malformed
inputs. Keep representative-reader evidence separate from fixture automation.
