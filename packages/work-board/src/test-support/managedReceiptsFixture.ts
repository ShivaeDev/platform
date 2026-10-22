import type { RequestReceipt } from "#attention/RequestReceipt.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";

const ITEM = "decision.context";
const REQUEST = "context.1";
const DECISION_FILE = "responses/decision.context.md";
function decisionFor(responseFrom: readonly string[]) {
	return `---\n${JSON.stringify({
		attention: [
			{
				id: REQUEST,
				kind: "decision",
				managed: true,
				reason: "Board context changed",
				"response_from": responseFrom,
				state: "open",
				unblocks: ["task.context"],
			},
		],
		id: ITEM,
		kind: "question",
		scope: "task",
		urgency: "whenever",
	})}\n---\n# Fleet decision for task.context\n`;
}
const decision = decisionFor(["maintainer"]);
const revision = revisionOf(decision);
const question = questionId(ITEM, REQUEST, revision, DECISION_FILE);
const ANSWER = "response.retry";

export function managedReceiptsFixture(responseFrom: readonly string[] = ["maintainer"]): Record<string, string> {
	const source = decisionFor(responseFrom);
	const reviewed = revisionOf(source);
	const asked = questionId(ITEM, REQUEST, reviewed, DECISION_FILE);
	return {
		[DECISION_FILE]: source,
		"responses/answer.md": responseMarkdown({
			body: "Proceed on the current task revision.",
			id: ANSWER,
			response: {
				answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
				author: "orchestrator",
				question: asked,
				recordedAt: 2000,
				reviewedRevision: reviewed,
				type: "answer",
			},
		}),
		"responses/question.md": questionMarkdown({
			context: source,
			id: asked,
			question: {
				deadline: 9000,
				item: ITEM,
				reason: "Board context changed",
				registeredAt: 1000,
				request: REQUEST,
				reviewedRevision: reviewed,
				source: DECISION_FILE,
			},
		}),
		"task.md": "---\nid: task.context\nkind: task\nstatus: ready\nowner: codex\n---\n# Changed context task\n",
	};
}

export function requestReceipt(name: string, receipt: RequestReceipt) {
	return {
		[`responses/request-receipt.${name}.md`]: `---\n${JSON.stringify({ id: `request-receipt.${name}`, kind: "report", "request_receipt": receipt })}\n---\n# Managed request acknowledgement\n`,
	};
}

export function managedReceipt(name: string, disposition: "applied" | "superseded", recordedAt: number, reviewedRevision = revision) {
	return requestReceipt(name, { disposition, question, recordedAt, ...(disposition === "applied" ? { response: ANSWER } : {}), reviewedRevision });
}

export function changedAnswer(): Record<string, string> {
	return {
		"responses/changed.md": responseMarkdown({
			body: "Stop and hand the task back.",
			id: "response.release",
			response: {
				answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
				author: "orchestrator",
				question,
				recordedAt: 2500,
				reviewedRevision: revision,
				supersedes: ANSWER,
				type: "answer",
			},
		}),
	};
}

export function openAsk(): Record<string, string> {
	return {
		"ask.md": `---\n${JSON.stringify({
			attention: [
				{
					id: "scope",
					kind: "decision",
					reason: "Confirm the task scope",
					"response_from": ["maintainer"],
					state: "open",
					unblocks: ["task.context"],
				},
			],
			id: "decision.scope",
			kind: "question",
			scope: "task",
			urgency: "whenever",
		})}\n---\n# Scope for task.context\n`,
	};
}
