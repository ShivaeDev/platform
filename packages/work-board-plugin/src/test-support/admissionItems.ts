export const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const DAY = 86_400_000;

export const buildThePane = {
	agents: [
		{ finishedAt: null, id: "worker", role: "worker", running: true, startedAt: NOW - 2 * MINUTE, state: "coding" },
		{ finishedAt: null, id: "reviewer", role: "reviewer", startedAt: null, state: "not started yet" },
	],
	document: { title: "Build the pane" },
	inFlight: true,
	stage: "working",
	stageEnteredAt: NOW - DAY,
	workId: "build",
};

export const finishedTurnDaysAgo = {
	...buildThePane,
	agents: [{ finishedAt: NOW - 3 * DAY + MINUTE, id: "worker", role: "worker", startedAt: NOW - 3 * DAY, state: "waiting for CI" }],
};

export const waitingOnDependency = {
	document: { title: "Ship the integration" },
	inFlight: false,
	stage: "waiting",
	waitingReason: "waiting for dependency task.foundation",
	workId: "dependency",
};

export const waitingOnArea = {
	document: { title: "Render the Board" },
	inFlight: false,
	stage: "waiting",
	waitingReason: "waiting for area work-board",
	workId: "area",
};

export const queuedForSlot = { document: { title: "Run the next worker" }, inFlight: false, stage: "queued", workId: "slot" };
