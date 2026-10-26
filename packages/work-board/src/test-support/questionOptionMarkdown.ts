export function questionOptionMarkdown() {
	return `---
id: question.reading
kind: question
scope: task
urgency: whenever
status: ready
---
# Reading experience

::::question{id="display" select="one"}
### How should **replies** appear?

Keep **context** beside \`responses\` and [affected work](task.md).

- Read the proposal.
- Choose a direction.

:::option{id="history"}
### Full history

Keep **earlier direction** in \`responses\` with [affected work](task.md).

- Preserve the reasoning.
- Show previous replies.
:::

:::option{id="latest"}
### Latest reply

Show the newest reply.
:::
::::
`;
}
