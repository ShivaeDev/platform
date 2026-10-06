export const questionnaireSource = `---
id: investigation.choices
kind: investigation
attention:
  - id: direction
    kind: decision
    state: open
    response_from: [maintainer]
    reason: Choose the reading experience and its verification.
    unblocks: [investigation.choices]
---
# Reading experience

Keep the context, **reasoning** and [affected work](task.md) together.

\`\`\`mermaid
flowchart LR
  Question --> Response --> History
\`\`\`

::::question{id="display" select="one"}
### How should replies appear?

:::option{id="latest"}
**Latest reply** — compact, with older replies behind a link.
:::

:::option{id="history"}
**Full history** — keep earlier direction visible.
:::
::::

::::question{id="checks" select="many"}
### Which checks matter?

:::option{id="back"}
Back/forward keeps the selected response.
:::

:::option{id="reload"}
Reload restores the reading context.
:::
::::
`;
export const questionnaireAnswers = [
	{ prompt: "display", selected: ["history"], text: "Preserve why the direction changed." },
	{ prompt: "checks", selected: ["back", "reload"], text: "Check a narrow screen too." },
] as const;
