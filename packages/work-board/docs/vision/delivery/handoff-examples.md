# Local handoffs and ordinary agent file editing

D3 is approved: existing sessions can poll or wait for human answers, and the
person can copy a short instruction directing an existing agent to a prepared
Markdown file. There is no launcher, harness hook or automatic session wakeup.

## One bounded walkthrough

Review a uniquely identified project item. Open **Prepare an agent handoff**,
enter recipient, goal, constraints and next action, then preview and prepare.
The existing `--responses` opt-in permits the same Linux local writer to create
`handoffs/<stable-id>.md`; the original project item is unchanged.

The file's frontmatter records direction and the source SHA-256. Its body contains
the exact complete source that the person reviewed, including its original
frontmatter and declared acceptance criteria. A focused item's context is bounded
to 256 KiB. Markdown/Mermaid context uses the existing safe local rendering path.

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
    text: Escape returns focus to the opening control.
---
# Keyboard focus

The complete reviewed item continues here.
```

The example revision is a placeholder; actual files contain the source SHA-256.
Copy tiny prompt emits a JSON-quoted absolute path and the instruction to read
that file and edit receipt. Paste it into the intended agent session. If clipboard
permission is unavailable, the UI selects the prompt for manual copying.

## Receipt and source ownership

The agent edits `handoff.state` to acknowledged, rejected or unavailable and can
add `handoff.by` and `handoff.note`. Ordinary unknown metadata is preserved.
Recipient/by are literal local labels, not authentication. Requested means the
file exists and receipt is unconfirmed. Silence does not imply rejection or
unavailability; receipt establishes neither execution nor verified acceptance.
The agent still owns project edits outside human response content. Result review
belongs to step 19.

Same-ID retries preserve raw receipt bytes and extra metadata. Different direction,
moved or duplicate identities are conflicts. Initial preparation checks the
reviewed source revision/path; later reads qualify earlier or unavailable context
and retain saved history. A missing or unreadable receipt is not inferred from
task status. Drafts share the existing 30-day/2-MiB browser-local workspace store.
There is no special acknowledgment command, editor lock or universal transaction.

## Evidence and limits

The step 18 roadmap records actual service, browser and current-session receipt
checks. An automated human browser and the implementation Codex session are not
representative-user timing or an independent agent implementation run. Local
Claude Code absence establishes only this environment's unavailable delivery
route; it says nothing about another machine or global harness support. No
agent process is started and no wait RAM/48-hour soak claim is added here.

Direct project editing/undo remains deferred at 17. D4 before 24 is unchanged.

## Execution addon boundary

Work Board owns the stable work ID, reviewed context, relationships and human
feedback. An execution addon such as Work Fleet can attach its own session/turn
receipts, reservations and execution stages to that Board ID; it must not create
a competing work identity or reinterpret `handoff.state` as completed work,
criterion acceptance or permission to merge. Board reading and response/handoff
files remain usable without an execution addon.

Consume the published package boundary rather than importing Work Board's private
`#` modules or writing through a second publisher. The native `handoffSource`,
`handoffs` and `prepareHandoff` contracts use the existing `workRpcs` browser/client
session; creation requires explicit response-write opt-in. Ordinary Markdown
receipt edits remain sufficient. The source snapshot SHA-256 identifies reviewed
content, not a session/turn, wire replay token or Git commit. This checkpoint
introduces no provider launcher, task scheduler or delivery authority. Addon
credentials, provider commands and private configuration belong outside public
source.
