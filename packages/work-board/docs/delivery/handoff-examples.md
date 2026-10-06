# Local handoffs and ordinary agent file editing

A person can prepare reviewed direction as a Markdown file, then copy a short
instruction into an existing agent session. The agent reads and edits ordinary
files to record receipt. The [roadmap](../roadmap.md) owns implementation status,
acceptance and decisions about extending this boundary.

## One bounded walkthrough

Review a uniquely identified project item. Open **Prepare an agent handoff**,
enter recipient, goal, constraints and next action, then preview and prepare.
The existing `--responses` opt-in permits the Linux local writer to create
`handoffs/<stable-id>.md`; the original project item stays unchanged.

The file's frontmatter records direction and the reviewed source SHA-256. Its body
contains the complete source, including original frontmatter and declared criteria.
A focused item's context is bounded to 256 KiB of UTF-8. The page renders its
Markdown/Mermaid body through the safe local context renderer and discloses the
exact source separately.

```markdown
---
id: handoff.search.keyboard.1
kind: handoff
handoff:
  item: work.search
  recipient: agent-navigation
  state: requested
  source: items/search.md
  reviewed_revision: 691e2b8c3ca54cd66afa1533e9917cbef69e8a13a5bb79275abf65a101ee6dde
  prepared_at: 1791319869349
  goal: Fix keyboard focus
  constraints: Preserve no-JavaScript links and local-only operation.
  next_action: Inspect the current source and report browser evidence.
---
---
id: work.search
kind: task
criteria:
  - id: focus
    text: Escape returns focus to the opening control
---
# Keyboard focus

Keep the source readable.
```

This complete example captures `items/search.md`, beginning at its own second
frontmatter block. Its reviewed revision is the SHA-256 of those captured bytes,
including the final newline. The server assigns `prepared_at` when it prepares
the record.

**Copy tiny prompt** gives a JSON-quoted absolute path and the instruction to read
that file and edit receipt. Paste it into the intended existing agent session.
When clipboard permission is unavailable, the UI selects the prompt for manual
copying. Preparing a file records `requested`; it does not notify, wake or launch
an agent. Existing agent sessions can still poll or wait for human answers through
the independent question/response commands.

## Receipt and source ownership

The agent edits `handoff.state` to `acknowledged`, `rejected` or `unavailable` and
can add `handoff.by` and `handoff.note` through its usual file tools:

```yaml
state: acknowledged
by: agent-navigation
note: Received; execution has not started.
```

These fields belong inside the record's `handoff` mapping. Recipient and `by` are
literal local labels, not authenticated identities. `requested` means the file
was prepared and receipt remains unconfirmed. Silence does not establish rejection
or unavailability; receipt establishes neither execution nor verified acceptance.
The agent owns project edits outside human response content. Returned-result
review belongs to the delivery requirements for step 19.

Same-ID preparation retries preserve raw receipt bytes and extra metadata, even
if the original source disappears. Different direction or a moved/duplicate record
identity is a conflict. Initial preparation checks the reviewed source revision
and path. Later reads qualify earlier or unavailable context and retain saved
history. Malformed or ambiguous history stays unavailable; task status does not
supply a missing receipt.

Browser drafts share the existing 30-day/2-MiB workspace store. Clearing workspace
drafts clears response and handoff drafts together, without deleting saved records.
There is no special acknowledgment command, editor lock or universal transaction
with unrelated editors.

## Native integration

The public `handoffSource`, `handoffs` and `prepareHandoff` operations use the
existing `workRpcs` session. `browserClient` exposes them under `handoffs`, beside
its reading and response bindings. Read the source preview before preparing it;
the command takes the exact reviewed revision and logical source path. Creation
requires the existing response-write opt-in. Ordinary receipt edits remain
sufficient after publication.

Consume the published defining modules rather than private `#` aliases or a second
publisher. The [README](../../README.md#use-the-native-browser-client) shows a
complete native-client preparation program. The source SHA-256 identifies reviewed
content; it is neither a session/turn ID, a wire replay token nor a Git commit.

## Optional execution integration boundary

Work Board owns the stable work ID, reviewed context, relationships and human
feedback. An execution integration can attach its own session/turn receipts,
reservations and stages to that work ID. It must not create a competing work
identity or reinterpret `handoff.state` as completed work, criterion acceptance
or permission to merge. Board reading and response/handoff files remain usable
without the integration.

An existing-session notification hook would need an actual supported tool API,
delivery/restart evidence and an owner. Explicit CLI launch would also introduce
executable, working-directory, credential, model-cost and process-lifetime choices.
Keep those choices in the roadmap until the maintainer selects a concrete contract.
Provider commands, credentials and private configuration belong outside public
source. A copied instruction never promises automatic agent continuation.

## Evidence boundaries

The roadmap links the service and DOM regressions. They establish the asserted
file, RPC, draft/navigation and manual-copy behavior. A browser fixture does not
establish representative-reader timing, independent model task execution,
physical-device behavior or support
for every harness. CLI availability is not delivery or receipt proof. The passive
wait's deadline/resource evidence is separate from handoff publication.
