import { inboxQuestion } from "./inboxFixture.ts";

export function closedInboxFixture(): Record<string, string> {
	const files: Record<string, string> = { "question.md": inboxQuestion };
	for (const [status, count] of [
		["done", 3],
		["draft", 2],
		["dropped", 1],
		["deferred", 1],
	] as const) {
		files[`${status}.md`] = `---\nid: task.${status}\nkind: task\nstatus: ${status}\nowner: codex\n---\n# ${status} task\n`;
		for (let ask = 1; ask <= count; ask += 1) {
			files[`asks/${status}-${ask}.md`] = `---
id: decision.${status}.${ask}
kind: question
scope: task
urgency: whenever
attention:
  - id: approval
    kind: decision
    managed: true
    state: open
    reason: ${status} ask ${ask}
    response_from: [maintainer]
    unblocks: [task.${status}]
---
# Ask ${ask} for ${status} task
`;
		}
	}
	return files;
}
