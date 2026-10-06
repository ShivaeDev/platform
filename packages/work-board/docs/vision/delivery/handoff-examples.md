# D3 discussion: a local handoff without a special agent editor

This is a proposal for discussion, not an approved schema, launcher or implemented
handoff action. The approved ownership boundary keeps agents using ordinary files.
The existing per-question wait returns human direction to an agent that attached
itself; it does not deliver a newly prepared task to an arbitrary existing session.

## One bounded walkthrough

The person reviews work.search and asks an existing agent to implement the keyboard
fix. Work Board prepares one local Markdown handoff with a stable identity,
recipient label, goal, constraints, source paths/revisions, acceptance criteria
and next action. The source files remain authoritative; the request records the
context the person reviewed.

The agent reads that file with its ordinary tools, records receipt by editing
Markdown, then edits the project normally. Receipt means it saw the request, not
that it has run the task, completed it, or earned human acceptance. A returned
result and its criterion evidence belong to step 19.

## Illustrative request, not settled syntax

```markdown
---
id: handoff.search.keyboard.1
kind: handoff
handoff:
  item: work.search
  recipient: agent-codex
  state: requested
  source: items/search.md
  reviewed_revision: REVIEWED_SHA256
---
# Fix keyboard focus

## Goal

Escape from the result detail returns focus to its opening control.

## Constraints

Keep no-JavaScript links and local-only operation. Leave pointer behavior intact.

## Acceptance

- Exercise opening and closing the detail with the keyboard.
- Record the observed browser behavior and any limits.

## Next action

Inspect the current source before changing it; report a changed premise.
```

For receipt, the agent can change state to acknowledged or rejected and add a
short attributed note using its normal file editor. Exact field names, attribution,
request/receipt ownership and source conventions still need D3 approval. No
acknowledgment command is mandatory. Requested/acknowledged/rejected/unavailable
are receipt states, independent of item status and verified acceptance. Recipient
labels are local attribution, not authenticated identities.

## Delivery choices

1. **Ordinary Markdown inbox plus a copied instruction.** Work Board prepares the
   request and provides its path and a short message the person can paste into an
   existing agent session. First demonstrate it with Codex; the file remains usable
   by Claude Code or another harness. This has the smallest integration cost and
   follows the approved editing rule. The person still delivers the pointer;
   Work Board must say prepared/requested rather than implying an agent was woken.
2. **An optional hook in one existing local harness.** A configured tool integration
   notifies its already-running agent to read the request file. Agents still edit
   normally and the file inbox remains usable without the hook. This removes a
   manual step but depends on real supported harness hooks; Codex/Claude/other
   harnesses do not expose interchangeable session-wakeup APIs. Tool-specific
   availability and restart evidence are required before claiming delivery.
3. **Start one explicitly configured local agent CLI.** An opt-in button launches
   a chosen tool with the request path; it edits and acknowledges through files.
   This gives automatic start but introduces executable/working-directory choices,
   credentials, model cost and process lifetime. It starts a new run rather than
   universally waking the session the person already uses. It is a larger scope
   than a file inbox; no agent fallback or general scheduler is implied.

## Recommendation and evidence limits

Start with 1 and a real Codex walkthrough. It gives useful human-to-agent direction
without demanding a new agent-side editor or binding ordinary Markdown to one
vendor. Add 2 only when an actual supported local hook removes a demonstrated
manual step. Choose 3 only if launching agents is an explicit desired workflow.

The current managed environment exposes a Codex CLI and normal file-reading/editing
agent tools; Claude Code is not installed here. CLI availability/help is not proof
of model execution, an existing-session wakeup, delivery or acknowledgment.
No handoff or new agent process was started to prepare this proposal.

## Acceptance if approved

Prove one actual agent reads the prepared request and records receipt using normal
file edits. Re-read after restart; repeated preparation with the same identity must
not silently create duplicate work. Preserve the same request when receipt is
missing or lost; do not infer rejection/unavailability from silence. A changed
source or recipient must be shown explicitly. Exercise explicit rejection and a
real unavailable delivery route. Keep human response content separate from agent
project edits and retain the current local-only/Markdown contracts.

The user decides this contract before step 18 is implemented. Steps 07/13 remain
pending representative-reader/device evidence; D4 before 24 is unchanged.
