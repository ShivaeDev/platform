# Work Board delivery requirements

Build the [north star](../north-star.md) as useful, reviewable changes. The
[roadmap](../roadmap.md) owns completion, acceptance and maintainer decisions;
numbers here name requirements and dependency order, rather than release dates.

Each step names a reader outcome, prerequisites, bounded implementation and
observable acceptance. Split a step when its review would mix independent risks.
Extend the existing source and Effect boundaries, and deliver a visible use with
its shared foundation.

## Delivery sequence

| Steps | Reader outcome | Review task |
| --- | --- | --- |
| [01–03](wave1.md#01-a-real-workspace-shell) | Browse and search a large folder | Use actual notes, keyboard navigation and a narrow layout |
| [04–06](wave1.md#04-optional-identity-and-a-rebuildable-index) | Read the same work across views, relationships and claims | Understand the source model outside the board |
| [07–09](wave1.md#07-an-attention-first-overview) | Find explicit attention and changes while keeping orientation | Return after an agent worked and identify the next judgment unaided |
| [10–13](wave1.md#10-local-visual-evidence) | Inspect visual evidence and read a complete project workflow | Review combined technical, reader and device behavior |
| [14–17](wave2.md#14-prove-one-safe-source-mutation) | Give durable direction without losing source or drafts | Exercise reviewed context, competing writers and clear outcomes |
| [18–20](wave2.md#18-one-local-agent-handoff) | Give one agent direction and review its returned result | Complete a real revision and explicit acceptance |
| [21–23](wave3.md#21-successive-contributions-with-clear-ownership) | Keep successive contributions and linked reviews coherent | Prove ownership and stale-contribution handling |
| [24–26](wave3.md#24-one-optional-read-only-github-adapter) | Remove demonstrated evidence/attention work | Admit each extension by its concrete manual step |

## Material for maintainer decisions

| Decision | Material | Boundary to preserve |
| --- | --- | --- |
| D1 Source structure | [Source examples](source-examples.md), plain Markdown, duplicates and invalid fields | Optional metadata and explicit identities without mandatory migration |
| D2 Responses and ownership | [Response contract](response-write-examples.md), [packet source](decision-write-examples.md), [result review](result-review-examples.md), [ordinary editing](source-editing-examples.md) | Human-owned response content, agent-owned project edits and practical recovery; authored report acceptance stays distinct from criterion evidence |
| D3 Handoff | [Copied-file handoff contract](handoff-examples.md) | Ordinary direction and file-edited receipt for an existing session; receipt is separate from execution and acceptance |
| D4 Evidence integration | Repeated manual step, authoritative fields, refresh/offline rules and maintenance owner | Explicit linked objects and usable local work without the adapter |

The roadmap records whether each decision is settled and what it means for a step.
The maintainer owns public APIs, file formats, dependencies and releases. Mockups
do not choose a serialization or framework. Prepare concrete examples before
asking for a new decision; normal acknowledgment must remain possible through
ordinary agent file edits.

## Extend the existing boundaries

| Boundary | Owns | Preserve |
| --- | --- | --- |
| [Shell](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/page/shell.ts), [navigation](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/page/nav.ts), [styles](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/page/style.ts) | Layout and reading controls | Readable server HTML, system fonts and local assets |
| [Board parser](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/render/board.ts), [Markdown renderer](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/render/markdown.ts) | Source interpretation and semantic reading | Heading boards, GFM, references and readable fallback |
| [Page route](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/http/page.ts), [router](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/board.ts) | Locations, projections and HTTP composition | Loopback boundary, embedding and Effect scope/errors |
| [Listing](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/files/list.ts), [watcher](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/files/changes.ts) | File discovery and freshness | Root policy, rename/delete handling and recovery |
| [Native client](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/browser/client.ts), [DOM swap](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/page/swap.ts) | Scoped reads and retained reading state | Shared Effect contracts/live primitives, clear failures and reconciliation |
| [Assets](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/http/assets.ts), [diagrams](https://github.com/ShivaeDev/platform/blob/main/packages/work-board/src/page/diagrams.ts) | Local visual reading | Bounded access and locally loaded renderers |

Keep CLI and embedding working together. Static mockup markup and fictional data
are review aids, not the production data model. A new framework, persistent store
or adapter must earn its cost through an agreed requirement.

## Evidence required

Name the step, visible outcome, source compatibility and exclusions in a change.
Behavior tests must fail without the change. Use pure parser tests for
interpretation, real filesystem/HTTP tests for serving/watching, and real browsers
for focus, layout, history and actual Mermaid. DOM fixtures establish their
asserted behavior; they do not establish browser-engine or device correctness.

Use a 50-document/100-item workspace with duplicate headings, nested/encoded paths,
missing references, diagrams, long text and malformed metadata, plus empty/small
folders. The [browser checks](browser-acceptance.md) and
[combined reading review](reading-review.md) provide repeatable procedures.
Measure on a named machine and agree numeric budgets before enforcing them.
Reader orientation targets require representative readers, not fabricated timing.

Record results and revised scope only in the roadmap. History belongs in Git and
the changelog. Preserve source compatibility, truthful evidence and ordinary
conflict recovery when reducing scope. Optional adapters do not become prerequisites
for the local product; no step adds cloud hosting, accounts or remote multiplayer.
