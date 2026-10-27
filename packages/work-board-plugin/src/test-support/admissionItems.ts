export const admissionItems = [
	{ document: { title: "Build the pane" }, stage: "working", workId: "build" },
	{
		attentionOwner: "automation",
		document: { title: "Ship the integration" },
		stage: "waiting",
		waitingReason: "waiting for dependency task.foundation: not done on the Board",
		workId: "dependent",
	},
	{
		attentionOwner: "orchestrator",
		document: { title: "Render the Board" },
		stage: "waiting",
		waitingReason: "waiting for area work-board held by task.other",
		workId: "area",
	},
	{ document: { title: "Run the next worker" }, stage: "queued", workId: "slot" },
	{
		attentionOwner: "orchestrator",
		document: { title: "Wait for execution capacity" },
		stage: "waiting",
		waitingReason: "execution capacity is occupied (limit 2)",
		workId: "capacity",
	},
	{ attentionOwner: "automation", stage: "waiting", waitingReason: "Waiting for required checks: typecheck", workId: "ci" },
	{ stage: "reviewing", workId: "review" },
	{ attentionOwner: "maintainer", stage: "waiting", waitingReason: "Approve the merge", workId: "merge" },
	{ attentionOwner: "maintainer", stage: "waiting", waitingReason: "Which approach should I use?", workId: "answer" },
];

export const reviewSlotWait = {
	attentionOwner: "automation",
	document: { title: "Review the existing PR" },
	prUrl: "https://github.com/example/project/pull/12",
	stage: "waiting",
	waitingReason: "execution capacity is occupied (limit 2)",
	workId: "review-slot",
};
