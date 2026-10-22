import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { decisionFile, decisionId, readyDecisionFixture } from "./answerCardFixture.ts";
import { requestReceipt } from "./managedReceiptsFixture.ts";

const source = readyDecisionFixture[decisionFile] ?? "";
const revision = revisionOf(source);
const question = questionId(decisionId, "direction", revision, decisionFile);
const ANSWER = "response.direction-retry";

export const ANSWERED_TASK =
	"---\nid: task.guide\nkind: task\nstatus: ready\nowner: claude\nnext_action: Answer the release decision\n---\n# Publish the install guide\n";
export const guideFleet: FleetItemsProjection = {
	completed: [],
	items: [{ attentionOwner: "maintainer", document: null, stage: "waiting", stageEnteredAt: 0, updatedAt: 0, workId: "task.guide" }],
	state: "ready",
};

export function answeredDecisionFixture(author = "maintainer"): Record<string, string> {
	return {
		...readyDecisionFixture,
		"guide.md": ANSWERED_TASK,
		[`responses/${question}.md`]: questionMarkdown({
			context: source,
			id: question,
			question: {
				deadline: 9000,
				item: decisionId,
				reason: "Reviewed PR is ready to merge.",
				registeredAt: 1000,
				request: "direction",
				reviewedRevision: revision,
				source: decisionFile,
			},
		}),
		[`responses/${ANSWER}.md`]: responseMarkdown({
			body: "Request changes",
			id: ANSWER,
			response: {
				answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
				author,
				question,
				recordedAt: 2000,
				reviewedRevision: revision,
				type: "answer",
			},
		}),
	};
}

export function appliedReceipt(response = ANSWER, recordedAt = 3000) {
	return requestReceipt("applied", { disposition: "applied", question, recordedAt, response, reviewedRevision: revision });
}
