const NOW = 1_800_000_000_000;
export const coding = {
	agents: [
		{ finishedAt: null, id: "worker", role: "worker", running: true, startedAt: NOW - 120_000, state: "coding" },
		{ finishedAt: null, id: "reviewer", role: "reviewer", startedAt: null, state: "not started yet" },
	],
	document: { title: "Build the pane" },
	inFlight: true,
	stage: "working",
	stageEnteredAt: NOW - 86_400_000,
	workId: "build",
};
export const admissionItems = [
	coding,
	{
		document: { title: "Ship the integration" },
		inFlight: false,
		stage: "waiting",
		waitingReason: "waiting for dependency task.foundation",
		workId: "dependency",
	},
	{ document: { title: "Render the Board" }, inFlight: false, stage: "waiting", waitingReason: "waiting for area work-board", workId: "area" },
	{ document: { title: "Run the next worker" }, inFlight: false, stage: "queued", workId: "slot" },
];
