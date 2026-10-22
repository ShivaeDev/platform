import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";

const HOURS_4 = 4 * 3_600_000;

function task(id: string, title: string, fields = "status: draft\nowner: codex") {
	return `---\nid: ${id}\nkind: task\n${fields}\n---\n# ${title}\n`;
}

export const fleetWorkspace = {
	"home.md": "# Workspace notes\n",
	"questions/tone.md":
		"---\nid: question.tone\nkind: question\nscope: task\nurgency: whenever\nnext_action: Which tone should the landing copy use?\n---\n# Landing copy tone\n",
	"tasks/email.md": task(
		"task.email",
		"Ship the onboarding email",
		"status: ready\nowner: claude\nattention:\n - id: review\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Review the onboarding email\n   unblocks: [task.email]",
	),
	"tasks/guide.md": task("task.guide", "Write the install guide"),
	"tasks/pricing.md": task(
		"task.pricing",
		"Draft the pricing page",
		"status: draft\nowner: marvin\nfleet: approved\nnext_action: Choose the pricing tiers.",
	),
	"tasks/upload.md": task("task.upload", "Fix the flaky upload test", "status: ready\nowner: codex"),
};

export function fleetWorkspaceItems(now: number): FleetItemsProjection {
	const entered = now - HOURS_4;
	return {
		completed: [],
		items: [
			{ attentionOwner: "automation", document: null, stage: "queued", stageEnteredAt: entered, updatedAt: now, workId: "task.guide" },
			{
				attentionOwner: "automation",
				document: null,
				prUrl: "https://github.com/example/project/pull/12",
				stage: "working",
				stageEnteredAt: entered,
				updatedAt: now,
				workId: "task.upload",
			},
			{ attentionOwner: "maintainer", document: null, stage: "waiting", stageEnteredAt: entered, updatedAt: now, workId: "task.email" },
		],
		state: "ready",
	};
}
