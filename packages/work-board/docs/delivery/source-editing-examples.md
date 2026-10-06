# Ordinary file editing and response ownership

Agents use their normal file-editing tools. Work Board adapts to those edits and owns the human response
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

The current publisher creates independent question/context, response and handoff
Markdown files. Agents edit handoff receipt through ordinary tools. This ownership
rule preserves that implementation; it does not introduce
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

These are ownership priorities. They do not define an inline-response serialization
or universal filesystem guarantees. Implementation and direct-editing/handoff
decisions belong in the [roadmap](../roadmap.md). A handoff must let the chosen
agent read and edit ordinary files; a required command for every acknowledgment
would contradict this boundary.

The [file/copy handoff contract](handoff-examples.md) carries reviewed direction
without replacing the project item. An optional harness delivery or execution
integration must preserve ordinary receipt edits and separate execution facts;
it cannot acquire authority to accept work from a receipt state.
