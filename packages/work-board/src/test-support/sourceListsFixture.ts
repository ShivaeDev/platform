export function sourceListsFixture(status = "done"): Readonly<Record<string, string>> {
	const decisions = Array.from({ length: 4 }, (_, index) => ({
		attention: [
			{
				id: "direction",
				kind: "decision",
				managed: true,
				reason: "Review publishing",
				"response_from": ["maintainer"],
				state: "closed",
				unblocks: ["task.guide"],
			},
		],
		id: `decision.guide.${index}`,
		kind: "decision",
		relationships: [{ kind: "relates_to", target: "task.guide" }],
	}));
	const task = {
		id: "task.guide",
		kind: "task",
		relationships: [
			{ kind: "implements", target: "project.guide#reading" },
			{ kind: "informs", target: "note.guide" },
			...decisions.map((entry) => ({ kind: "relates_to", target: entry.id })),
		],
		status,
	};
	return {
		"goal.md": "---\nid: project.guide\nkind: project\nstatus: active\ncriteria:\n - id: reading\n   text: Read linked work\n---\n# Finish line",
		"link.md": "---\nid: note.guide\n---\n# A note without status",
		"task.md": `---\n${JSON.stringify(task)}\n---\n# Publish the guide\n\nKeep the instructions clear.`,
		...Object.fromEntries(
			decisions.map((entry, index) => [`decisions/${index}.md`, `---\n${JSON.stringify(entry)}\n---\n# Fleet decision for task.guide`]),
		),
	};
}
