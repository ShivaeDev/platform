import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { goalsFixture } from "./goalsFixture.ts";

export function goalPageFixture(): Readonly<Record<string, string>> {
	const files = goalsFixture();
	return {
		...files,
		"claims.md": "# Claims without criterion evidence",
		"first.md": files["first.md"]?.replace("status: done", "status: planned") ?? "",
		"goal.md": `${files["goal.md"]}\n\n## Why this goal matters\n\nAuthored context follows the linked work.\n\n<article><p>Authored nested article.</p></article>`,
		"third.md": files["third.md"]?.replace("target: project.example#second", "target: project.example") ?? "",
	};
}

export function closedGoalPageFixture(status = "completed"): Readonly<Record<string, string>> {
	const files = goalPageFixture();
	const linked = Object.fromEntries(
		Object.entries(files).map(([file, source]) => [file, source.replaceAll("target: project.example", "target: project.closed")]),
	);
	return {
		...linked,
		"closed-result.md":
			"---\nid: result.closed\nkind: result\nstatus: done\nrelationships:\n - kind: implements\n   target: project.closed#first\n - kind: implements\n   target: project.closed\n---\n# Closed result",
		"closed.md": (files["goal.md"] ?? "")
			.replace("id: project.example", "id: project.closed")
			.replace("status: planned", `status: ${status}`)
			.replace("# Example goal", "# Closed goal"),
		"first.md": (linked["first.md"] ?? "").replace("status: planned", "status: in-progress"),
	};
}

export function goalFleetFixture(
	stage: "executing" | "reviewing" | "needs-human" = "executing",
): Extract<FleetItemsProjection, { readonly state: "ready" }> {
	return {
		completed: [{ completedAt: 0, document: null, stage: "completed", stageEnteredAt: 0, updatedAt: 0, workId: "task.second" }],
		items: [
			{ document: null, prUrl: "https://github.com/example/project/pull/1", stage, stageEnteredAt: 0, updatedAt: 0, workId: "task.first" },
			{ document: null, stage: "prepared", stageEnteredAt: 0, updatedAt: 0, workId: "task.third" },
			{ document: null, stage: "released", stageEnteredAt: 0, updatedAt: 0, workId: "task.fifth" },
		],
		state: "ready",
	};
}
