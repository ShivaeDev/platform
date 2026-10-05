# Work Board delivery plan

Build the [north star](../README.md) as a sequence of useful, reviewable changes.
The [roadmap](../roadmap.md) defines wave scope and owns completion status. The checklist
there tracks implementation; numbers here express recommended order,
not dates or a promise that each step fits exactly one pull request.

Each numbered step is a PR-sized target with a user outcome, prerequisites, a
bounded implementation, and observable acceptance. Split a step when its review
would mix independent risks. Keep shared foundations small and deliver their
first visible use in the same step. Do not implement later waves to make an
earlier PR look complete.

## Delivery sequence

| Order | Steps | What becomes useful | Review checkpoint |
| --- | --- | --- | --- |
| 1 | [01–03: navigate](./wave1.md#01-a-real-workspace-shell) | A large folder is comfortable to browse and search | Use the actual project notes, including keyboard and narrow layout |
| 2 | [04–06: understand the work](./wave1.md#04-optional-identity-and-a-rebuildable-index) | Several views expose the same items, with evidence and relationships | Confirm the source model is understandable outside the board |
| 3 | [07–09: stay oriented](./wave1.md#07-an-attention-first-overview) | Overview explains what needs attention and what changed | Return after an agent has worked and find the next judgment unaided |
| 4 | [10–13: finish wave 1](./wave1.md#10-local-visual-evidence) | Rich documents, onboarding, local export, and a dependable reading workspace | Wave 1 exit in the roadmap; only then activate wave 2 |
| 5 | [14–17: inform back](./wave2.md#14-prove-one-safe-source-mutation) | Contextual responses and narrow edits survive competing writers | Review the write model and use it on real project files |
| 6 | [18–20: coordinate](./wave2.md#18-one-local-agent-handoff) | One agent receives direction, returns evidence, and participates in review | Complete one feature through a real revision and acceptance |
| 7 | [21–23: collaborate locally](./wave3.md#21-successive-contributions-with-clear-ownership) | Several contributions remain coherent; context spans local projects | Prove ownership and conflict behavior before broadening scope |
| 8 | [24–26: bounded extensions](./wave3.md#24-one-optional-read-only-github-adapter) | Selected evidence imports and quiet rules remove actual manual work | Admit each integration by demonstrated value, not connector count |

Recommended first three implementation PRs: **01 shell and navigation**, **02
document locations and history**, **03 search and command palette**. These can
ship without content editing, agent APIs, or external integrations.

## Decisions, at the point they become necessary

| Gate | Before | Concrete material to discuss | Working recommendation, not a settled API |
| --- | --- | --- | --- |
| D1 Source structure | 04 | [Plain-text examples](./source-examples.md): existing heading board, richer item, linked decision/evidence; invalid/duplicate cases | Optional metadata, stable explicit IDs for durable references, readable fallback; no mandatory migration |
| D2 Responses and writes | 14 | Exact before/after file diffs, source revision contract, concurrent editor scenario, undo and trust behavior | Begin with one structured response on one file, then add narrow field edits |
| D3 Handoff contract | 18 | One real producer/consumer walkthrough, acknowledged/rejected/lost response cases, payload examples | One local tool adapter; no scheduler, terminal manager, or generic agent protocol |
| D4 Integration admission | 24 | A repeated manual evidence step, source of truth, refresh/offline rules, credentials and maintenance ownership | Read explicitly linked GitHub objects only; no two-way sync |

The maintainer decides public API shape, file format, new dependencies, and
release boundaries. Prepare reviewable examples before asking. D1 does not block
01–03; D2 does not block wave 1. Exact syntax, storage location, endpoint names,
and frontend technology are intentionally not decided by the mockups or this plan.
If durable browser automation needs a new dependency, bring that narrow choice
with the first browser acceptance slice rather than silently installing it.

## Build from the existing implementation

| Existing boundary | Extend it for | Preserve |
| --- | --- | --- |
| [Page shell](../../../src/page/shell.ts), [navigation](../../../src/page/nav.ts), [styles](../../../src/page/style.ts) | Workspace layout, navigation, tokens, view controls | Server-rendered readable content, system fonts, local assets |
| [Board parser](../../../src/render/board.ts), [Markdown renderer](../../../src/render/markdown.ts) | Optional identity, source locations, semantic blocks | Existing heading boards, GFM, references, footnotes, raw-HTML compatibility until explicitly revised |
| [Page route](../../../src/http/page.ts), [router layer](../../../src/board.ts) | Locations, projections, bounded queries, later commands | Existing URLs, loopback boundary, embedding and Effect service/error semantics |
| [File listing](../../../src/files/list.ts), [watcher](../../../src/files/changes.ts) | Rebuildable index and invalidation | Root containment, rename/delete handling, retry and recovery |
| [Live client](../../../src/page/client.ts), [DOM swap](../../../src/page/swap.ts) | Scoped refresh, view state, attention and freshness | Open details, diagrams, failure visibility, reconnect catch-up |
| [Assets](../../../src/http/assets.ts), [diagrams](../../../src/page/diagrams.ts) | Local evidence and visual inspection | Bounded asset access and locally loaded renderers |

Keep the current CLI and embedding entry working throughout. Do not turn the
mockup's static markup and fictional data into the production data model. Start
from the existing rendering path; adopt a client framework or database only for
a demonstrated requirement and an agreed design.

## Evidence required for each step

For each PR, name its step ID, visible outcome, exclusions, source compatibility,
and demonstration. Add behavior tests that fail without the change, update the
package changelog and applicable docs, and run the relevant checks. Follow the
repository's handoff gate; report skipped or blocked checks accurately. Never
grow the quality baseline to make the design fit.

Use pure parser tests for interpretation, real filesystem/HTTP tests for serving
and watching, and real-browser checks for focus, layout, history, and interaction.
The existing Happy DOM tests help with behavior but do not establish visual or
browser-engine correctness. Keep an example workspace with 50 documents and 100
items, duplicate headings, nested paths, missing references, diagrams, long text,
and intentionally malformed metadata. Include small/empty folders too.

Measure first render, search response, single-file update cost, and state
preservation on a named reference machine. Establish numeric budgets from the
first baseline and agree them before enforcing a performance gate. The north
star's 30-second orientation and two-step evidence access are usability targets,
not fabricated benchmark results. Accessibility and responsive behavior belong
in each affected step; the wave-end pass covers the combined experience.

## Keeping the plan honest

After every review checkpoint, record actual evidence and any revised scope in
the roadmap using these step IDs. A step is complete when its outcome works in
the real package, not when a design, fixture, or mockup exists. Ship useful steps
incrementally; package version bumps and releases remain explicit maintainer
decisions. Do not start the next wave because a calendar estimate expired.

If scope grows, first reduce component breadth, advanced layouts, and adapter
count. Preserve source compatibility, truthful evidence, and conflict handling.
Steps 24–26 are optional extensions, not prerequisites for a successful local
collaboration product. No cloud hosting, accounts, sync, or remote multiplayer
enters any step.
