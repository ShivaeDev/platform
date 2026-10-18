import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

const ITEM = "decision.context";
const REQUEST = "context.1";
const DECISION_FILE = "responses/decision.context.md";
const decision = `---\n${JSON.stringify({
	attention: [
		{
			id: REQUEST,
			kind: "decision",
			managed: true,
			reason: "Board context changed",
			"response_from": ["maintainer"],
			state: "open",
			unblocks: ["task.context"],
		},
	],
	id: ITEM,
	kind: "decision",
})}\n---\n# Fleet decision for task.context\n`;
const revision = revisionOf(decision);
const question = questionId(ITEM, REQUEST, revision, DECISION_FILE);
const ANSWER = "response.retry";

export function managedReceiptsFixture(): Record<string, string> {
	return {
		[DECISION_FILE]: decision,
		"responses/answer.md": responseMarkdown({
			body: "Proceed on the current task revision.",
			id: ANSWER,
			response: {
				answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
				author: "orchestrator",
				question,
				recordedAt: 2000,
				reviewedRevision: revision,
				type: "answer",
			},
		}),
		"responses/question.md": questionMarkdown({
			context: decision,
			id: question,
			question: {
				deadline: 9000,
				item: ITEM,
				reason: "Board context changed",
				registeredAt: 1000,
				request: REQUEST,
				reviewedRevision: revision,
				source: DECISION_FILE,
			},
		}),
		"task.md": "---\nid: task.context\nkind: task\nstatus: ready\nowner: codex\n---\n# Changed context task\n",
	};
}

export function managedReceipt(name: string, disposition: "applied" | "superseded", recordedAt: number, reviewedRevision = revision) {
	const receipt = {
		disposition,
		question,
		recordedAt,
		...(disposition === "applied" ? { response: ANSWER } : {}),
		reviewedRevision,
	};
	return {
		[`responses/request-receipt.${name}.md`]: `---\n${JSON.stringify({ id: `request-receipt.${name}`, kind: "result", "request_receipt": receipt })}\n---\n# Managed request acknowledgement\n`,
	};
}
