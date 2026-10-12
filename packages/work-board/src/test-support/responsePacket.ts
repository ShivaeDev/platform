import { questionId, questionMarkdown, revisionOf } from "#server/responses/records.ts";

export const DECISION_PATH = "responses/decision.fixture.md";
export const decisionContext = `---
${JSON.stringify({
	attention: [{ id: "direction", kind: "decision", managed: true, reason: "Choose a direction", state: "open" }],
	id: "decision.fixture",
	kind: "decision",
})}
---
# Choose a direction

Read the evidence before choosing.

## Recommendation

Keep the source readable.
`;
const revision = revisionOf(decisionContext);
const id = questionId("decision.fixture", "direction", revision, DECISION_PATH);
export const questionPath = `responses/${id}.md`;
export const questionPacket = questionMarkdown({
	context: decisionContext,
	id,
	question: {
		deadline: 172_800_000,
		item: "decision.fixture",
		reason: "Choose a direction",
		registeredAt: 0,
		request: "direction",
		reviewedRevision: revision,
		source: DECISION_PATH,
	},
});
export const packetFiles = { "home.md": "# Home", [DECISION_PATH]: decisionContext, [questionPath]: questionPacket };
