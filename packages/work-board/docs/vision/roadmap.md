# Work Board roadmap

The [north star](./README.md) defines the direction. All unchecked work below is
proposed and unimplemented. Completion requires the stated observable behavior
and relevant checks; a mockup or a checked design document is not feature proof.
Waves describe dependency order, not a calendar commitment.

The [step-by-step delivery plan](./delivery/README.md) turns these waves into
26 bounded implementation steps. Start with steps 01–03: workspace shell,
document locations, then search. Each step names its prerequisites and acceptance
evidence; the plan also records the source-format, mutation, handoff, and integration
discussion gates. Record completed step IDs and their proof here as delivery
proceeds. No implementation step is complete yet.

## Current foundation

The existing package serves a local Markdown folder, renders a designated home
file as sections and cards, and updates open pages in place. It provides GFM,
highlighted code, Mermaid, watcher recovery, and an embeddable Effect router.
Its README and tests remain the authority for current behavior.

## Wave 1 — Stay informed

Deliver a complete, read-oriented workspace that works while agents continue
editing ordinary files. Navigation preferences and saved local views may change;
the UI does not mutate project content in this wave.

| Slice | Proposed scope | Acceptance evidence |
| --- | --- | --- |
| W1.1 Orientation | Overview, attention queue, explanatory priority, empty state, onboarding templates | A user can find an explicitly recorded decision, blocker, and result; empty folders explain how to start |
| W1.2 Navigation | Collapsible sidebar, titles, folders, breadcrumbs, favorites, recents, search, command palette, anchors, source-in-editor links | Find a phrase and open its exact document/card in a 50-document fixture; keyboard navigation works |
| W1.3 Views | Document, board, table, overview, detail pane, multiple boards, saved filters, compact/comfortable density | The same source item appears consistently in each view; selecting it preserves the surrounding context |
| W1.4 Visual content | Safe local images/attachments, callouts, comparisons, metrics, progress, galleries; diagram zoom/fullscreen/export | Assets respect root boundaries; rich content has meaningful plain-text fallback; large diagrams remain usable |
| W1.5 Relationships | Read-side optional identity/metadata, backlinks, goals, decisions, dependencies, acceptance criteria, evidence links | A result can be traced to its plan and decision; broken/duplicate references are visible |
| W1.6 Awareness | Changed since last visit, source/freshness labels, stale evidence, restrained update highlighting, pause/resume updates | New content is distinguishable from activity; resuming catches up while preserving position and expanded content |
| W1.7 Finish | Themes, responsive layouts, accessible focus/status, print/local HTML export, targeted updates | Browser checks cover desktop and narrow layout, keyboard, reduced motion, reconnect, and offline core use |

- [ ] Agree the smallest optional read-side metadata convention; support legacy
  heading-based boards unchanged and treat missing metadata as unknown.
- [ ] Deliver W1.2 + W1.3 as the first vertical slice: a larger workspace can be
  searched, browsed, and inspected comfortably.
- [ ] Add W1.1 + W1.5 using explicit source fields; do not infer blockers or
  completion from wording, section names, or file age.
- [ ] Complete W1.4, W1.6, and W1.7 with a small fixed component vocabulary.
- [ ] Benchmark selective invalidation and rendering using realistic documents
  and many cards; add virtualization only when evidence justifies it.

**Exit:** a person can return to a locally served project, understand its state,
find the reasoning, and inspect its evidence without scrolling through a log or
asking an agent to reconstruct the context. No external account is required.

## Wave 2 — Inform back and coordinate

This wave is agreed in direction, with the interaction and write model still
open for discussion. The mockups show possibilities, not settled public APIs.

### Design gate before content mutations

- [ ] Decide the first response surface: anchored note, structured decision,
  revision request, checklist/status edit, or a deliberately small combination.
- [ ] Decide canonical storage and stable identity: how a single-document board
  evolves toward one file per item without maintaining two authored truths.
- [ ] Specify source-preserving patches, revision checks, atomic replacement,
  undo, failure recovery, and treatment of concurrently edited files.
- [ ] Specify source trust and request authorization for new write routes.
  Loopback binding and CSP alone do not constitute a write authorization design.
- [ ] Decide who owns priority, assignment, acceptance, and handoff acknowledgment.
  An agent's completed run must not silently accept its own result.
- [ ] Agree a minimal local handoff contract with one existing agent tool;
  avoid inventing a scheduler or binding the core to one vendor.

| Slice | Proposed scope | Acceptance evidence |
| --- | --- | --- |
| W2.1 Respond | Anchored feedback, revision requests, decision comparison and recording | The response retains its source revision and evidence context; a later edit cannot silently change what was approved |
| W2.2 Edit | Create/edit items, toggle checklist, change status, explicit move controls, optional drag-and-drop, undo | A narrow edit changes only the intended source; stale writes are surfaced; keyboard actions match pointer actions |
| W2.3 Coordinate | Goal/constraints/acceptance handoff, owner and next action, waiting/running/review states, acknowledgment | One real tool receives a handoff and returns a result; failures, duplicate submissions, and missing acknowledgment are visible |
| W2.4 Review | Criterion-level evidence, source diffs, requested revisions, acceptance distinct from run completion | A real item goes from proposal through a revision to accepted result with readable source records |

**Exit:** complete one local feature workflow with a person and an agent. The
person can give direction in context, understand whether it was received, and
review the result. Concurrent edits cannot silently discard work.

## Wave 3 — Collaborate, with bounded integrations

Build on the validated write and handoff model. Keep the product local.

- [ ] Support iterative co-editing and multiple agent contributions through the
  existing local files and tools, with explicit ownership and conflict resolution.
- [ ] Add a local cross-project overview only after the single-project loop works.
- [ ] Add richer compositions and dependency/timeline views where real metadata
  supports them; distinguish dates, estimates, and unknowns.
- [ ] Offer curated local review packets and export of decisions/evidence.
- [ ] Trial one read-only GitHub evidence adapter: a linked PR, checks, review,
  merge state, checked revision, and last successful refresh.
- [ ] Add local test/build artifact readers where they remove manual copying.
- [ ] Consider small explainable rules only after their triggers and ownership
  are reliable; suppress repeated unchanged notifications.

### Integration admission rule

Every adapter must name the manual step it removes, its authoritative source,
supported object(s), explicit opt-in, refresh behavior, offline behavior, and
maintenance owner. Start with linked objects rather than syncing an organization.
GitHub owns PR state; local files own the plan and authored decisions. No two-way
issue synchronization, generalized connector framework, or hosted component is
part of this wave. An unavailable integration leaves local work fully usable and
marks imported evidence stale.

**Exit:** a person can collaborate across successive agent contributions without
losing context or ownership. The optional adapter earns its place in actual use;
it does not determine the product's architecture.

## Ideas retained, in dependency order

| Original proposal | Delivery home |
| --- | --- |
| Attention-first home | Wave 1; actions arrive in wave 2 |
| Multiple views of the same work | Wave 1; richer timeline/dependencies in wave 3 |
| Stronger visual workspace | Wave 1, then continuous refinement |
| Rich visual documents | Fixed components in wave 1; composition grows in wave 3 |
| Direct manipulation | Wave 2, discussion gate |
| Plans, decisions, implementation, evidence | Read in wave 1; review/write in wave 2 |
| Human–agent handoffs | Wave 2, discussion gate; iterative collaboration in wave 3 |
| Changes and provenance | Wave 1; mutation provenance extends in wave 2 |
| External evidence | Narrow optional wave 3 adapter |
| Starting, finding, sharing | Wave 1 templates/search/local export; local review packets in wave 3 |

## Always out of scope

Cloud hosting, accounts, cloud sync, remote multiplayer, public publishing,
arbitrary executable widgets, a plugin marketplace, a general rich-text editor,
agent execution infrastructure, and an event-sourcing requirement.
