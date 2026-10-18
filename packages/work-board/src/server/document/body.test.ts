import { expect } from "vitest";
import { questionId, questionMarkdown, revisionOf } from "#server/responses/records.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { decisionContext, questionPacket, questionPath } from "#test/responsePacket.ts";

boardStory.it(
	"reads a registered question's captured prose without exposing its nested header",
	[projectFiles({ [questionPath]: questionPacket })],
	function* ({ readDocument }) {
		const content = yield* readDocument(questionPath);
		expect(content.source).toContain("Read the evidence before choosing.");
		expect(content.source).not.toContain('"id":"decision.fixture"');
	},
);
for (const [name, source] of [
	["unregistered", `---\nid: question.authored\nkind: question\n---\n${decisionContext}`],
	["changed context", questionPacket.replace("Read the evidence", "Changed evidence")],
	["damaged identity", questionPacket.replace("id: question.", "id: damaged.")],
] as const) {
	boardStory.it(`keeps ${name} question bodies intact`, [projectFiles({ [questionPath]: source })], function* ({ readDocument }) {
		expect((yield* readDocument(questionPath)).source).toContain('"id":"decision.fixture"');
	});
}
const CONTEXT = "# Plain question\n\nBefore\n\n---\n\nAfter\n\n```yaml\n---\nattention: []\n---\n```\n";
const revision = revisionOf(CONTEXT);
boardStory.it(
	"retains thematic breaks and code examples in captured prose",
	[
		projectFiles({
			[questionPath]: questionMarkdown({
				context: CONTEXT,
				id: questionId("task.fixture", "direction", revisionOf(CONTEXT), "task.md"),
				question: {
					deadline: 172_800_000,
					item: "task.fixture",
					reason: "Choose",
					registeredAt: 0,
					request: "direction",
					reviewedRevision: revision,
					source: "task.md",
				},
			}),
		}),
	],
	function* ({ readDocument }) {
		expect((yield* readDocument(questionPath)).source).toBe(CONTEXT);
	},
);
