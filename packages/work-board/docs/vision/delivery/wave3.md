# Wave 3 delivery — collaborate locally

These proposed steps extend the real loop proven in [wave 2](./wave2.md). They
implement the final wave of the [roadmap](../roadmap.md). Step 21 is the core
collaboration outcome. The remaining steps are independently useful extensions;
especially 24–26 should earn their place rather than block local collaboration.

## 21 Successive contributions with clear ownership

**Outcome:** several agents and a person can contribute without obscuring who
owns the next action. Extend 18–19's single-contributor loop to explicit transfer,
contribution references, conflicting proposals, and a visible current owner.
Retain the expected source revision for every contribution and response. Start
with coordinated turns and merges of reviewable proposals; simultaneous text
co-editing is not a prerequisite and would need a separate design.
**Depends on:** 20. **Accept:** two real contributors act on the same work,
one stale contribution is identified, and the person resolves the next handoff
without losing either proposal. An unavailable owner is visible, not reassigned
silently. No remote multiplayer or new execution infrastructure is introduced.

## 22 Several local projects, one attention view

**Outcome:** a person can find the next judgment across explicitly selected local
workspaces. Aggregate the attention/read model, preserving project-qualified IDs,
source roots, per-project preferences, and independent availability. Opening a
result returns to its original workspace and exact context. Scope folder access
explicitly; do not scan the user's machine or widen serving to every filesystem.
**Depends on:** 07–09 and 21. **Accept:** identical item IDs in two projects do not
collide; one unavailable folder does not hide the others or route an action into
the wrong project. Keep writes owned by the originating workspace.

## 23 Richer plans and linked reviews

**Outcome:** larger work can be understood and reviewed as a coherent whole.
Extend the fixed component vocabulary with bounded split layouts, dependency
maps, and timelines where explicit relationships/dates support them. Distinguish
unknown dates from estimates and commitments. Help a reviewer follow linked plans,
decisions, criteria, evidence, revisions and limitations inside the normal workspace.
**Depends on:** 11–12 and 19. **Accept:** a reviewer follows those source links and
sees missing or stale evidence clearly. Cycles and unresolved dependencies are shown.
Shareable/exported packets are outside scope. Do not
grow a freeform executable dashboard or plugin system to implement these views.

## 24 One optional read-only GitHub adapter

**Outcome:** a linked PR's current evidence no longer requires repeated copying.
At D4, pick one repeated workflow and specify its authoritative fields. Read only
explicitly linked PRs and their checks/review/merge state; record checked commit,
last successful observation, refresh failures, and provenance. Keep credentials
outside project content and make opt-in/out explicit. Local plans and decisions
remain authored locally; the adapter does not overwrite them.
**Depends on:** 19 and D4; can proceed independently of 22–23 after wave 2 exits.
**Accept:** a changed PR revision makes old check evidence stale; unavailable or
unauthorized GitHub access leaves the local board usable. No organization crawl,
issue replication, write-back, cloud service, or generic connector framework.

## 25 Read existing local test and build artifacts

**Outcome:** locally produced results can support criteria without manual prose.
Select one actual machine-readable report produced by the project's existing
commands. Parse it through the same provenance/evidence model, including run
identity, relevant source revision where available, completed/partial state, and
failures. Observe results; do not turn the board into a command runner. Add another
format only after the first reader proves useful.
**Depends on:** 10 and 19; independent of GitHub adapter adoption.
**Accept:** an interrupted report is incomplete, an unrelated revision does not
verify the current work, malformed input yields a useful diagnostic, and deleting
the artifact makes the evidence unavailable rather than leaving an eternal pass.

## 26 Quiet rules and a real collaboration review

**Outcome:** stable, explainable signals reduce attention overhead.
Start with one observed need, such as surfacing a newly reviewable result. Show
the source fact, the reason a rule fired, and its last action. Deduplicate unchanged
events and allow disabling the rule. Rules may surface or suggest; handing off
work or accepting results requires an explicit authority policy agreed separately.
**Depends on:** 21 and a reliable trigger from 19, 24, or 25; no adapter is mandatory.
**Accept:** repeated identical observations remain quiet, recovery does not flood
the queue, and every surfaced item explains itself. Complete a real collaboration
review, compare orientation/response effort with the earlier workflow, and retain
only extensions that remove demonstrated friction.

## Stop conditions for scope growth

Pause an adapter or advanced view if it requires a second source of truth,
organization-wide synchronization, a hosted component, or more maintenance than
the manual step it replaces. Keep the existing local workflow complete when any
extension is disabled. Expand only from observed use, not feature parity with a
project-management suite. Release timing and additional API/package choices stay
with the maintainer.
