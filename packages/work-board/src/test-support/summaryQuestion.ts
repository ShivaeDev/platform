export function summaryQuestion(status: string) {
	return `---
id: question.direction
kind: question
scope: task
urgency: whenever
status: ${status}
attention:
 - id: direction
   kind: decision
   state: open
   response_from: [maintainer]
   reason: Choose a direction
   unblocks: [question.direction]
---
# Choose a direction
`;
}
