import { questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { attentionSources } from "./attentionLaneTraits.ts";
import { inboxFixture, inboxQuestion } from "./inboxFixture.ts";

export function inbox(
	files: Readonly<Record<string, string>> = {},
	line = "the project has a person's next action, agent work, an open question and a Fleet decision",
) {
	return attentionSources({ ...inboxFixture(), ...files }, line);
}

const revision = revisionOf(inboxQuestion);
const storageQuestion = questionId("question.storage", "answer", revisionOf(inboxQuestion), "question.md");
const answer = {
	body: "Keep local files",
	id: "response.storage",
	response: { author: "Casey", question: storageQuestion, recordedAt: 101, reviewedRevision: revision, type: "answer" as const },
};
export function answered(type: "answer" | "clarify" = "answer", source = inboxQuestion) {
	return inbox(
		{
			"question.md": source,
			"responses/answer.md": responseMarkdown({ ...answer, response: { ...answer.response, type } }),
			"responses/question.md": questionMarkdown({
				context: inboxQuestion,
				id: storageQuestion,
				question: {
					deadline: 200,
					item: "question.storage",
					reason: "Answer",
					registeredAt: 100,
					request: "answer",
					reviewedRevision: revision,
					source: "question.md",
				},
			}),
		},
		`Casey's ${type} to the storage question is recorded${source === inboxQuestion ? "" : ", and the question changed since"}`,
	);
}

const delivery = inboxFixture()["responses/decision.md"] ?? "";
const deliveryRevision = revisionOf(delivery);
const deliveryQuestion = questionId("decision.delivery", "delivery", revisionOf(delivery), "responses/decision.md");
export const fleetChain = inbox(
	{
		"responses/fleet-answer.md": responseMarkdown({
			...answer,
			id: "response.fleet",
			response: { ...answer.response, question: deliveryQuestion, reviewedRevision: deliveryRevision },
		}),
		"responses/fleet-question.md": questionMarkdown({
			context: delivery,
			id: deliveryQuestion,
			question: {
				deadline: 200,
				item: "decision.delivery",
				reason: "Answer",
				registeredAt: 100,
				request: "delivery",
				reviewedRevision: deliveryRevision,
				source: "responses/decision.md",
			},
		}),
	},
	"the Fleet delivery decision has a registered question and a recorded answer",
);
