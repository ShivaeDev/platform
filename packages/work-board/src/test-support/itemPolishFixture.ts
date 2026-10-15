export function itemPolishFixture(evidence = false): Readonly<Record<string, string>> {
	const criteria = "criteria:\n  - id: layout\n    text: The item is readable\n  - id: links\n    text: Source links are useful\n";
	return {
		"done.md": `---\nid: task.done\nkind: task\nstatus: done\nfleet: approved\n${criteria}relationships:\n  - kind: implements\n    target: goal.fixture\n---\n# Finished item\n\nMerged PR: [#390](https://github.com/ShivaeDev/platform/pull/390).`,
		"goal.md": `---\nid: goal.fixture\nkind: goal\nstatus: active\n${criteria}---\n# Readable workspace\n\nKeep the context close to the work.`,
		"notes.md": "# Reading notes\n\nRead the [finished item](done.md).",
		"planned.md": `---\nid: task.planned\nkind: task\nstatus: planned\nfleet: approved\nflavor: sweet\n${criteria}relationships:\n  - kind: implements\n    target: goal.fixture\n  - kind: depends_on\n    target: task.done\n---\n# Next item\n\nPlan the next change.`,
		"reports/review.md": `---\nid: report.review\nkind: report\nstatus: done\nrelationships:\n  - kind: informs\n    target: task.done\n${evidence ? "evidence:\n  - source: ../done.md\n    criterion: task.done#layout\n    outcome: passed\n" : ""}---\n# Item review\n\nThe reading layout was checked.`,
	};
}
