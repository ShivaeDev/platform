function task(id: string, title: string) {
	return `---\nid: ${id}\nkind: task\nstatus: planned\nowner: orchestrator\nfleet: approved\n---\n# ${title}\n`;
}

function question(id: string, target: string, audience: string, link: "unblocks" | "relates_to") {
	return `---\n${JSON.stringify({
		...(link === "unblocks"
			? { attention: [{ id: "pick", kind: "decision", reason: "Pick a path", "response_from": [audience], state: "open", unblocks: [target] }] }
			: {}),
		id,
		kind: "question",
		relationships: [{ kind: "relates_to", target }],
		status: "open",
	})}\n---\n# Which path?\n`;
}

// One task waits on the reader's answer, one on an agent's, and one only relates to an open question.
export const nowAsksFixture = {
	"asks/agent.md": question("question.agent", "task.agent", "orchestrator", "unblocks"),
	"asks/related.md": question("question.related", "task.related", "maintainer", "relates_to"),
	"asks/yours.md": question("question.yours", "task.yours", "maintainer", "unblocks"),
	"home.md": "# Home",
	"tasks/agent.md": task("task.agent", "Waits on an agent"),
	"tasks/related.md": task("task.related", "Relates to a question"),
	"tasks/yours.md": task("task.yours", "Waits on you"),
};
