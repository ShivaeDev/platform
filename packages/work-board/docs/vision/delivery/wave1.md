# Wave 1 delivery — stay informed

The [delivery plan](./README.md) explains gates and verification. These steps
implement W1.1–W1.7 of the [roadmap](../roadmap.md), which tracks completion. The UI reads
project content; only personal view preferences change. Agents keep writing files
through their existing tools. Follow numeric order unless the prerequisites below
permit a useful independent change.

## 01 A real workspace shell

**Outcome:** opening the existing folder feels like a navigable workspace.
Replace the wrapping top bar with a collapsible sidebar and breadcrumbs; use a
readable document measure and a wider board canvas. Introduce shared color,
spacing, typography, density, and light/dark/system theme tokens. Keep existing
routes and `--home` behavior. Add the representative workspace and browser
acceptance path alongside this visible change, not as a standalone framework.
[Browser acceptance](./browser-acceptance.md) uses the shared large-workspace fixture.
**Depends on:** the vision. **Accept:** 50 documents do not push the content out
of reach; keyboard focus, narrow screens, diagrams, and live updates still work.

## 02 Document locations and reading state

**Outcome:** users can point to a passage and return without losing their place.
Add heading anchors, an outline, active-file/title treatment, back/forward
behavior, favorites, and recents. Resolve relative links from the source file,
including a nested home file served at `/`. Preserve selection, open details, and
scroll when navigating back. Scope local preferences to the workspace.
**Depends on:** 01. **Accept:** duplicate headings have unambiguous anchors;
encoded filenames work; a deleted target explains what happened. Document that
generated heading anchors can change after a rename; durable item IDs come in 04.

## 03 Find work from anywhere

**Outcome:** one search locates a phrase, document, or heading across the folder.
Add a keyboard-opened search/command dialog with snippets, explicit result types,
empty results, and navigation to the matching passage. Begin with a small
rebuildable text index and deterministic matching. Refresh it on file changes.
Offer source-in-editor navigation only through an agreed local editor mechanism.
**Depends on:** 02. **Accept:** a known phrase is findable in the large fixture;
keyboard selection and Escape restore focus; stale requests cannot replace newer
results. Review 01–03 with real project notes before expanding the model.

## 04 Optional identity and a rebuildable index

**Outcome:** richer work is recognizable without making plain Markdown invalid.
Prepare D1's examples, then implement the agreed read-side schema and source
locations. Model optional IDs, item kind, status, owner, next action, relationships,
criteria, and evidence provenance as needed by the first real examples. Reuse and
extend 03's index. Display useful diagnostics for malformed metadata, duplicate
IDs, and unresolved references while keeping prose readable.
**Depends on:** 03 and D1. **Accept:** existing boards render unchanged; the index
rebuilds entirely from files; unknown metadata is not guessed or silently lost.

## 05 One body of work, several views

**Outcome:** document, board, and table offer consistent views of the same items.
Add multiple board selection, filtering/sorting, saved local views, compact mode,
and a side detail pane. URL state restores the view and selected item. Use the
agreed board declaration to separate a view from a status; a section name alone
must not become an inferred workflow rule. No dragging or content writes yet.
**Depends on:** 01 and 04. **Accept:** counts and selections agree across views,
filters remain applied during updates, and a disappearing selection is explained.
Split board/detail and table/saved-views into two PRs if each needs a large review.

## 06 Follow the reasoning and the evidence

**Outcome:** a result leads to its criteria, plan, decision, and supporting files.
Render decision options, rationale, backlinks, dependencies, and criterion-level
evidence. Show origin, checked revision, and observed time where explicitly
provided. Missing evidence and an agent's unsupported claim remain distinct from
verified results. Begin with readable links; inline asset previews arrive in 10.
**Depends on:** 04–05. **Accept:** the sample result reaches its source rationale
in two navigation steps; broken links and evidence for an old revision stay visible.

## 07 An attention-first overview

**Outcome:** returning users can identify the next judgment without reading a log.
Derive queues for explicit decision requests, blockers, and review requests. Each
entry names why it appears, whose response is needed, and what it unblocks. Use
simple visible ordering and link directly to 05/06's context. Include quiet and
empty states. Do not treat file churn, heartbeat, or a finished agent run as progress.
**Depends on:** 05–06. **Accept:** representative users can find the intended next
judgment within the proposed 30-second target; ambiguous items stay unclassified.

## 08 What changed since I last looked

**Outcome:** readers distinguish meaningful changes from an unchanged busy process.
Track local last-viewed markers and compare retained source revisions for explicit
field/content changes. Show additions, removals, changed decisions, and evidence
updates with source links. Define bounded retention and clearing before retaining
snapshots. If history is unavailable, say so; modification time is not a diff.
**Depends on:** 04 and 07. **Accept:** a returning view summarizes a known sequence
of edits correctly; a first visit, cleared storage, or renamed source never invents
history or authorship. No durable event journal is required.

## 09 Live updates that preserve orientation

**Outcome:** the workspace stays current without disturbing active reading.
Use changed paths to invalidate affected documents, derived views, search results,
and backlinks. Keep navigation updates when files are added/deleted. Add pause,
pending-change count, restrained highlighting, and resume. Recover with a full
reconciliation after reconnect or uncertain watcher state; never trust a path-only
optimization when events may have been missed.
**Depends on:** 05–08. **Accept:** unrelated edits avoid full active-document
rerenders; focused controls, open details, and diagrams survive relevant changes;
paused and reconnecting states catch up without claiming stale data is current.

## 10 Local visual evidence

**Outcome:** screenshots and diagrams are inspectable inside the work context.
Serve an explicitly allowed set of local attachments with root containment and
correct media handling; watch their changes as well as Markdown. Resolve paths
relative to source files. Add image preview/gallery and Mermaid zoom, fullscreen,
and local export, with useful load/parse errors and keyboard dismissal.
**Depends on:** 02 and 06; can precede 07–09 if needed by actual evidence.
**Accept:** local images render and update; traversal/symlink escapes are refused;
large diagrams can be read on narrow screens without losing the source context.

## 11 A small vocabulary for visual documents

**Outcome:** plans can communicate through comparisons, callouts, and progress.
Implement the agreed readable conventions for callouts, option comparisons,
metric/progress blocks, and a simple timeline. Use existing semantic data where
possible. Keep the initial component list fixed, with text alternatives and no
arbitrary executable content. Counts and metrics must name their source; unknown
values should not display a fabricated percentage.
**Depends on:** 04, 06, and 10. **Accept:** the real project brief communicates its
plan using these blocks, remains useful in a text editor, and degrades intelligibly
when a component's input is incomplete. Complex composition waits for 23.

## 12 Start and take the work with you

**Outcome:** a new user can begin locally and produce a readable local handoff.
Provide copyable templates for a project, investigation, and agent result; useful
empty-state instructions; good print output; and a bounded static HTML export of
selected documents and local assets. Browser print may produce PDF; do not add a
PDF service. Preview export scope, report missing assets, and make relative links
work in the exported bundle. An `init` CLI command needs a separate API decision.
**Depends on:** 07 and 10–11. **Accept:** start from an empty folder and inspect an
export with the server stopped and external networking unavailable.

## 13 Prove the complete reading workflow

**Outcome:** wave 1 is a dependable tool, not only a convincing demonstration.
Use it for real project notes while agents update the source through existing
tools. Exercise the full large/empty/malformed fixtures, reconnects, rename/delete,
keyboard focus, contrast, reduced motion, desktop/narrow layouts, and embedding.
Measure agreed performance budgets and preserve all existing package guarantees.
**Depends on:** 01–12. **Accept:** record the roadmap's wave 1 exit evidence and
remaining limitations. Discuss D2 using examples from this use before authorizing
wave 2 mutations; do not fix usability gaps by adding an agent execution engine.
