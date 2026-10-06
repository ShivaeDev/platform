export const REVIEW_TASK =
	"---\r\nid: work.keyboard\r\nkind: task\r\nstatus: in-review\r\ncriteria:\r\n  - id: focus\r\n    text: Escape restores focus\r\n  - id: narrow\r\n    text: Narrow layout stays readable\r\n---\r\n# Keyboard work\r\n";

export function reviewResult(version = "First report") {
	return `---
id: result.keyboard
kind: result
status: finished
relationships:
  - kind: implements
    target: work.keyboard
attention:
  - id: review
    kind: review
    state: open
    response_from: [maintainer]
    reason: Review this exact result and its limitations.
    unblocks: [work.keyboard]
evidence:
  - criterion: work.keyboard#focus
    source: ../evidence/focus.md
    checked_revision: '0123456789012345678901234567890123456789'
    method: Actual keyboard check
    outcome: Focus restored in the recorded check
---
# ${version}

## Limits
Narrow-screen evidence is not recorded. Execution completion is a report, not acceptance.

\`\`\`mermaid
flowchart LR
  Result --> Review --> Revision
\`\`\`

::::question{id="verdict" select="one"}
### What should happen with this report?

:::option{id="revision"}
Request another revision and explain the missing evidence.
:::

:::option{id="accept"}
Accept this exact report version with the stated limitations.
:::
::::
`;
}
