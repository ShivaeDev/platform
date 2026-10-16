const revision = "a".repeat(64);
const records = [
	{
		explanation: "Receipt is separate from execution and acceptance.",
		fields: {
			handoff: {
				constraints: "",
				goal: "Review the evidence",
				item: "task.fixture",
				"next_action": "Inspect the result",
				"prepared_at": 0,
				recipient: "reader",
				"reviewed_revision": revision,
				source: "task.md",
				state: "requested",
			},
			id: "handoff.fixture",
			kind: "handoff",
		},
	},
	{
		explanation: "Unanswered deadline:",
		fields: {
			id: "question.fixture",
			kind: "question",
			question: {
				deadline: 0,
				item: "task.fixture",
				reason: "Review the evidence",
				registeredAt: 0,
				request: "review",
				reviewedRevision: revision,
				source: "task.md",
			},
		},
	},
	{
		explanation: "This is authored feedback, not verified acceptance.",
		fields: {
			id: "response.fixture",
			kind: "response",
			response: { author: "reader", question: "question.fixture", recordedAt: 0, reviewedRevision: revision, type: "answer" },
		},
	},
	{
		explanation: "This acknowledges request handling, not execution, acceptance or delivery authority.",
		fields: {
			id: "receipt.fixture",
			kind: "result",
			"request_receipt": { disposition: "applied", question: "question.fixture", recordedAt: 0, reviewedRevision: revision },
		},
	},
];

export const recordSourceFixture = records.map(({ explanation, fields }) => ({
	explanation,
	file: `${fields.kind}.md`,
	source: `---\n${JSON.stringify(fields)}\n---\n# Recorded direction\n`,
}));
