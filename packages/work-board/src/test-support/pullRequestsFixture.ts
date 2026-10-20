import type { BoardFixtureOptions } from "#test/inMemoryBoard.ts";

export type CurrentFleet = Extract<NonNullable<BoardFixtureOptions["fleet"]>, { state: "ready" }>;

export function pullRequestsFixture(at: number) {
	const rows = [
		["ready", "needs-human", "maintainer", 12],
		["sweep", "needs-human", "maintainer", 13],
		["checks", "validating", "automation", 14],
		["repair", "repairing", "automation", 15],
		["question", "needs-human", "maintainer", 16],
		["orchestrator", "needs-human", "orchestrator", 17],
		["review", "reviewing", "automation", 18],
		["released", "released", "automation", 19],
		["completed", "completed", "automation", 20],
	] as const;
	const items = rows.map(([name, stage, attentionOwner, number]) => ({
		attentionOwner,
		document: null,
		prUrl: `https://github.com/example/project/pull/${number}`,
		...(name === "ready"
			? { review: { sourcePath: "responses/review.ready.md", tldr: "Verdict: request changes\n- New users need a next action." } }
			: {}),
		stage,
		stageEnteredAt: at - 5 * 60_000,
		updatedAt: at,
		workId: `task.${name}`,
	}));
	const files = Object.fromEntries(
		rows.map(([name]) => [
			`tasks/${name}.md`,
			`---\nid: task.${name}\nkind: task\nstatus: ${name === "ready" ? "done" : "active"}\n---\n# Deliver ${name}\n`,
		]),
	);
	for (const [name, reason] of [
		["ready", "The PR passed review and all required checks. It is ready to merge."],
		["sweep", "The sweep PR passed review and all required checks. It is ready to merge before held PRs."],
		["question", "Which database should we use?"],
	]) {
		files[`responses/${name}.md`] = `---\n${JSON.stringify({
			attention: [{ id: "ask", kind: "decision", managed: true, reason, "response_from": ["maintainer"], state: "open", unblocks: [`task.${name}`] }],
			id: `decision.${name}`,
			kind: "decision",
		})}\n---\n# Fleet decision\n`;
	}
	return { files, fleet: { completed: [], items, state: "ready" as const } };
}

export function mergedPullRequest(fleet: CurrentFleet, workId: string, at: number): CurrentFleet {
	const item = fleet.items.find((entry) => entry.workId === workId);
	if (!item) {
		throw new Error(`No current Fleet item ${workId}`);
	}
	return {
		completed: [...fleet.completed, { ...item, completedAt: at, stage: "completed", stageEnteredAt: at }],
		items: fleet.items.filter((entry) => entry.workId !== workId),
		state: "ready",
	};
}
