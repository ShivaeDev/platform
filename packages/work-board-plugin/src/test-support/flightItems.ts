import { buildThePane, NOW } from "#test/admissionItems.ts";

const metadata = { relationships: [{ kind: "implements", target: "goal.ship-the-board" }] };

export const groupedBuild = { ...buildThePane, document: { ...buildThePane.document, metadata } };
export const groupedMerge = {
	...buildThePane,
	agents: [
		{ finishedAt: NOW, id: "worker", role: "worker", startedAt: NOW - 24 * 60_000, state: "waiting for merge" },
		{ finishedAt: NOW, id: "reviewer", role: "reviewer", startedAt: NOW - 3 * 60_000, state: "approved" },
	],
	document: { metadata, title: "Merge the pane" },
	prUrl: "https://github.com/example/platform/pull/42",
	stage: "waiting",
	workId: "merge",
};

export const longTitle = {
	...groupedBuild,
	document: { metadata, title: "Build the pane with a title that is longer than the pane can display on its task line" },
};
