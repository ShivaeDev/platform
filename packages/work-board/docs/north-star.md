# Work Board north star

Work Board is a local, file-backed workspace for a person and their agents to
understand work and exchange direction. Open it to know what is happening, what
changed, what needs judgment, and where the evidence lives. Close it without
losing the work: the meaningful content remains readable in project files.

The [roadmap](roadmap.md) owns implementation status, acceptance gaps and open
maintainer decisions. The [README](../README.md) teaches current use. The
[experience design](experience.md) and [interactive prototype](mockups/index.html)
illustrate the product direction with fictional data. The
[delivery requirements](delivery/README.md) define bounded steps and how to
verify them, without keeping a second status list.

## The problem

Agents can produce plans, code, reports and questions faster than a person can
read them. A terminal shows activity; a chat holds a conversation; neither makes
it easy to return to a project and identify the judgment that matters. Evidence
gets detached from the result it supports, and the difference between a completed
run and an accepted piece of work disappears.

A person needs a place to read that material together without maintaining a
parallel project-management system. Agents should keep editing ordinary files.
Editors and Git should remain useful independent of the board. Optional structure
should connect the work, rather than turn every note into a form.

## Who it serves

The primary reader is a developer coordinating their own work and several agents
across project files. A document can remain narrative while its identified work
appears in a board or table. Relationships connect a goal to its plan, decision,
implementation, criteria and result. Views arrange those sources for different
questions; they do not create competing copies.

Human responses belong to their reviewed context. Work Board owns the response
content it records; agents own the surrounding project Markdown and use normal
file edits. This [ownership boundary](delivery/source-editing-examples.md) accepts
rare outside-editor races while requiring practical drafts, revision checks and
clear ordinary save failures.

A handoff preserves reviewed direction in another readable file. A copied pointer
lets an existing agent session read it; ordinary edits record receipt. That receipt
does not establish execution or acceptance. An execution integration can refer to
the same work identity without becoming a prerequisite or another source of truth.

Returned work needs the same discipline. An authored result and its evidence are
claims to inspect. Human direction belongs to the exact report bytes and source
path that prompted it; a later edit must not inherit an earlier acceptance. A
report iteration can receive human acceptance while a criterion still lacks
evidence. The board must keep those facts visible rather than compute a convenient
overall success state.

## What good looks like

- **Readable source.** A folder and one command are enough to begin. Plain
  Markdown remains useful; metadata is optional; no hidden database holds the
  only meaningful copy of work.
- **Calm awareness.** Attention means an explicit question, blocker or review
  request. Quiet ongoing work should remain quiet. File churn is not progress.
- **Evidence before activity.** Running, producing output, finishing a run,
  recording a claim, receiving a response and satisfying criteria remain distinct.
- **Direction in context.** Responses and handoffs stay connected to the source
  and evidence the person reviewed. They do not disappear into a second generic
  chat feed; receipt remains distinct from execution and acceptance.
- **Honest freshness.** Source locations, reviewed revisions, provenance and
  uncertainty remain visible. A summary leads back to its supporting material.
- **Coherent reading.** Documents, cards, tables, diagrams and decisions share
  navigation, source links and a readable visual language. Live changes preserve
  the reader's place, with deliberate pause and reconciliation.
- **Local independence.** Core reading needs no hosted service, account or cloud
  sync. Optional integrations cannot become prerequisites for the local workflow.

## The direction

The product grows in three useful stages:

1. **Stay informed.** Read plans, progress, results, questions and uncertainty
   while agents work through their existing tools.
2. **Inform back and coordinate.** Respond in context, record direction, request
   revisions and make the next handoff understandable.
3. **Collaborate.** Refine successive contributions with clear ownership,
   preserved context and inspectable evidence.

A good reading experience is a product in its own right. Coordination earns its
place by reducing repeated context assembly; it must not force a new agent runtime.

## Trade-offs

Readable source wins over richer hidden state. Explicit unknowns win over a
helpful-looking guess about status, identity or acceptance. Preserved orientation
wins over redrawing every view after every event; uncertain delivery still requires
full reconciliation. Contextual direction wins over a general chat interface.

Practical ownership wins over a universal filesystem transaction engine. A saved
response retains the exact reviewed context; it cannot lock every unrelated editor
or claim that several project files changed atomically. Retaining a draft and
explaining an uncertain save are part of the product, not exceptional cleanup.

Shared Effect and Platform primitives win over a second RPC, client state or live
update implementation. Work Board owns its document/indexing policy and user
experience. Existing agent tools own execution; existing editors own project edits.
An adapter must remove a demonstrated manual step and keep that boundary visible.

## How to judge progress

The intended payoff is less effort to regain context and direct work. Useful
questions are whether a returning reader can find the actual blocker, reach its
source rationale and evidence, distinguish changes from churn, and respond without
reassembling the context. A representative workspace should include dozens of
documents and a hundred items, as well as empty, malformed and unavailable states.

Tests establish specific behavior. A browser fixture establishes the interactions
it exercises. Neither proves representative-reader orientation time, physical
device behavior or adoption. Proposed targets and their acceptance remain in the
roadmap until the maintainer accepts the evidence.

## What it leaves out

Work Board does not aim to become a generic project-management suite, agent
scheduler, terminal fleet, plugin marketplace, arbitrary script dashboard, rich-text
editor or event-sourcing system. Hosting, accounts, cloud sync, remote multiplayer,
public publishing, document export and shareable packet generation are outside the
product direction. A browser's ordinary printing and local image/diagram downloads
remain reading tools, rather than an artifact-generation service.

External evidence integration must be explicit and narrow: authoritative source,
linked objects, refresh behavior, offline behavior and a maintenance owner. A
read-only adapter may expose stale imported evidence; it must leave local authored
plans and decisions usable. Two-way synchronization and organization-wide crawling
would create competing sources of truth.
