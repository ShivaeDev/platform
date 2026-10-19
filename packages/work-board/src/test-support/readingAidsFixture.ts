export function criteriaTask(criteria: readonly string[]) {
	return `---
id: task.criteria
kind: task
status: planned
criteria:
${criteria.map((text, index) => `  - id: c${index + 1}\n    text: "${text}"`).join("\n")}
---
# Criteria task

Body.
`;
}

export const mergedTask = {
	diagnostics: [],
	file: "task.md",
	identity: "task.merged",
	links: {},
	metadata: { id: "task.merged", kind: "task" as const, nextAction: "Done; PR #764 merged after PR 12.", owner: "reader", status: "done" },
	modified: 0,
	questionActions: {},
	references: {},
	requests: [],
	source: "# Merged task\n",
	unavailable: [],
	writable: false,
};

export function pullRequestFleet(...urls: readonly string[]) {
	return {
		completed: [],
		items: urls.map((prUrl, index) => ({
			document: null,
			prUrl,
			stage: "reviewing" as const,
			stageEnteredAt: 0,
			updatedAt: 0,
			workId: `task.${index}`,
		})),
		state: "ready" as const,
	};
}
