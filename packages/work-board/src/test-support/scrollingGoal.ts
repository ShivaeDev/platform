export const scrollingGoal = `---
id: goal.reading
kind: goal
status: ready
criteria:
  - id: scroll
    text: Scrolling holds the reading position.
  - id: header
    text: The header expands when the reader returns to the top.
---
# Keep the reader in place while reviewing the work and answering open questions

Opening summary for the goal.

## Reading context

${Array.from({ length: 12 }, () => "The maintainer reads the work, its evidence and its open questions before choosing the next step. The reading position must stay stable while the item title remains available above the body.").join("\n\n")}
`;
