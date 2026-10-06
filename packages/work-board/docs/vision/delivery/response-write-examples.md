# D2: the first response and source-write boundary

Proposal for discussion, not an implemented writer or settled source contract.
Work Board currently reads source and records local reading preferences/history;
editors and agents remain the source writers. The next wave lets a person respond
inside the app so an agent can later read durable feedback in the same workspace.
It does not launch an agent, change status automatically or verify acceptance.

## First useful response

A person reads an investigation and says: “Use the explicit attention request
model. Keep unknown evidence unknown. Add the missing stale-source check.”
The response identifies the item and exact source revision reviewed; survives
reload; appears beside the linked investigation; and stays readable in an editor.
No project document is silently rewritten to simulate a coordinated multi-file
transaction. Future D3 decides how one real agent tool receives/acknowledges it.

For example: a person reads an agent's investigation, writes “keep the explicit
requests, but add a stale-source check”, previews the resulting Markdown, and
records it locally. The agent can read that durable feedback through its existing
file tools. Closing the browser after a successful save does not lose the response.

## Recommended first write: one new response file

Original file stays unchanged:

```markdown
---
id: investigation.attention
kind: investigation
---
# Attention request model

## Recommendation
Use explicit request records; do not infer requests from owner or status.
```

Proposed newly created `responses/response-123.md` (exact response fields still
need approval; these names illustrate what the contract must communicate):

```markdown
---
id: response.123
kind: response
response:
  item: investigation.attention
  source: investigation.md
  reviewed_revision: sha256:<exact reviewed source bytes>
  type: revision_request
---
# Response to attention request model

Keep explicit requests. Add the missing stale-source check before implementation.
```

The renderer also links back to the reviewed context. `kind: response` and the
`response` object would extend D1 only if approved; the example is not currently
valid D1 metadata and must not be shipped as a usable template before discussion.
The first release could instead record the response using ordinary Markdown plus
existing explicit relationships, if a richer response schema is unnecessary.

## Alternatives and tradeoffs

1. New response files: original formatting and agent edits remain intact; retries
   can use one response identity; a growing number of files needs clear grouping.
   Can establish atomic publication without replacing an unrelated writer's file,
   subject to filesystem capability checks. Recommended first boundary.
2. Append a response section to the reviewed item: all discussion stays in one
   file, but editor/agent replacements race with append/persist operations. Requires
   an explicit coordination or recovery model; compare-then-rename cannot promise
   safety against arbitrary outside writers.
3. Edit status/checklists first: visible and convenient, but less useful for giving
   rationale; conflates recorded work state and acceptance unless carefully designed.
   Keep for the later narrow-editing step.

## Draft, revision and save rules to approve

- Show exactly which file and content will be recorded before submission.
- Bind feedback to the reviewed item/source revision. On source changes or rename,
  retain the draft and show the difference; ask the person to review again before
  submitting. Do not silently attach an old approval to changed source.
- A retry with the same response ID cannot create a second contribution. Preserve
  the content if a result is rejected, failed or uncertain; reconcile persisted
  state before declaring saved or retrying a potentially completed write.
- A response is authored feedback, not verified acceptance. The first action is
  a note/revision request, not automatic closure of requests or completion of work.
- Read-side raw HTML does not acquire write authority. Explicit local write opt-in,
  command authorization, same-origin protection and official app controls need a
  demonstrated boundary; embedded source forms/markup must not trigger writes.
- No broad editor, source-format migration, automatic agent execution, cross-file
  rewriting, cloud identity or hosted collaboration.

## Demonstration before acceptance

Real filesystem and HTTP tests must prove stale revisions, outside-writer races,
rename/delete, permissions, write failure, uncertain outcomes and repeated
submissions. The filesystem capability/coordination strategy is part of the
contract; reject unsupported guarantees instead of pretending an arbitrary editor
participates in an app lock. Actual browser tests must preserve drafts through live
updates/navigation/failure and display distinct pending/saved/rejected/uncertain
outcomes. Existing native Platform command/error infrastructure owns the command
path; no independent hand-built write coordinator.

## Concrete competing-writer and trust examples

The person reviews revision A. An external editor replaces the investigation with
revision B while the response draft is open. Submission must disclose the change
and retain the draft; review B before rebinding the response. A preflight revision
check cannot prevent another external write immediately afterward, so a saved
response still names the exact reviewed bytes and never claims to approve every
future revision. Creating a separate response avoids overwriting revision B.

If the server saves a response but the connection drops before the reply, the UI
shows an uncertain result. Reconcile the response ID and exact content before
retrying; a conflicting existing file must not be replaced. Neither a timeout nor
a retry silently creates another contribution.

Reading an explicitly symlinked outside reference folder does not authorize
writing there. Write opt-in must name a workspace boundary and reject escaping or
changed links. Raw source HTML, including a forged button or form, must not become
an official command control. Embedded applications need an explicit command trust
boundary; the read-only default must remain usable.

Initial drafts could remain in the current browser window, or survive reload in
separate bounded local storage. The latter needs an explicit retention/clearing
policy; it must not silently reuse or change the Mark seen history baseline.
Persisted responses are ordinary source files; draft retention is a separate
decision. These examples settle no source schema, retention policy or writer API.
