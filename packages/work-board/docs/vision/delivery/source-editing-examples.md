# Ordinary file editing and response ownership

The maintainer approved this boundary on 6 October 2026. Agents use their normal
file-editing tools. Work Board adapts to those edits and owns the human response
content it records. Product complexity should follow the coordination workflow,
not rare concurrent-writer edge cases.

## Ownership

- Agent/project changes win outside the human response area: reasoning, task text,
  evidence, titles, checklists, status, and other surrounding Markdown.
- Human response content wins within its own response area. Recording feedback
  does not give Work Board ownership of the rest of the document.
- Agents do not have to use a special mutation command, cooperative lock,
  acknowledgment command, or editor protocol to edit files.
- A ready-for-review question is normally answered while the agent is waiting,
  rather than deliberately editing that question at the same time.

The current publisher creates independent question/context and response Markdown
files. This ownership rule preserves that implementation; it does not introduce
an inline-response syntax or silently rewrite an agent's project document.
If an inline response area is introduced later, the same ownership rule applies
within the shared file.

## Concrete example

An agent adds keyboard evidence to its investigation while the person drafts:

```markdown
Use the full history view. Keep the keyboard evidence and proceed.
```

Work Board records that human direction in the response. The agent's investigation
and new evidence remain authoritative. The response does not rewrite the item,
change its status, close attention, or establish acceptance. The agent reads the
feedback and updates its project Markdown using its ordinary tools.

If future response editing shares a file, re-read the current content and change
only the owned response area, retaining the agent's surrounding edits. Preserve
the draft and explain a detected stale target or ordinary save failure. Do not
restore an obsolete whole-file snapshot to implement undo.

## Best-effort engineering

Keep practical revision checks, drafts, ordinary filesystem failures and the
local workspace boundary. Do not require a universal transaction with every
outside editor, a native exchange/backup engine, or a special agent workflow as
prerequisites for progress. Rare racing saves and possible text loss are accepted
limitations of ordinary file editing. Detect obvious conflicts when inexpensive;
avoid making every response a concurrency-management interaction.

These are approved design priorities, not a claim that inline editing or stronger
filesystem guarantees have been implemented.

## Delivery consequence

Direct create/title/checklist/status/move controls and general source-file undo
from step 17 are deferred. Agent-owned project editing remains outside the current
Work Board writer. The roadmap keeps 17 unchecked and proceeds to step 18's D3
handoff discussion using the response loop already delivered in 14–16.

D3 must let the chosen agent keep reading and editing ordinary files. A required
vendor adapter or command for every acknowledgment would contradict this boundary.
Automatic delivery, execution-state records and the exact handoff convention
still require concrete examples and discussion before implementation. D4 before
step 24 and the outstanding representative-reader/device evidence remain open.
