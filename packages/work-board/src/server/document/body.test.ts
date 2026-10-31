import { expect } from "vitest";
import { questionId, questionMarkdown, revisionOf } from "#server/responses/records.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { decisionContext, questionPacket, questionPath } from "#test/responsePacket.ts";

const NESTED_HEADER = '"id":"decision.fixture"';

boardStory.it(
	"a registered question serves its captured prose without the nested header its file still holds",
	[projectFiles({ [questionPath]: questionPacket })],
	function* ({ documentSourceText, savedFile }) {
		expect(yield* savedFile(questionPath)).toContain(NESTED_HEADER);

		const source = yield* documentSourceText(questionPath);

		expect(source).toContain("Read the evidence before choosing.");
		expect(source).not.toContain(NESTED_HEADER);
	},
);

for (const [name, source] of [
	["an unregistered question", `---\nid: question.authored\nkind: question\nscope: task\nurgency: whenever\n---\n${decisionContext}`],
	["a question whose context changed after capture", questionPacket.replace("Read the evidence", "Changed evidence")],
	["a question whose identity no longer matches its capture", questionPacket.replace("id: question.", "id: damaged.")],
] as const) {
	boardStory.it(
		`${name} serves its whole body, nested header included`,
		[projectFiles({ [questionPath]: source })],
		function* ({ documentSourceText }) {
			expect(yield* documentSourceText(questionPath)).toContain(NESTED_HEADER);
		},
	);
}

const CONTEXT = "# Plain question\n\nBefore\n\n---\n\nAfter\n\n```yaml\n---\nattention: []\n---\n```\n";

boardStory.it(
	"captured prose keeps its thematic breaks and code examples that look like front matter",
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
					reviewedRevision: revisionOf(CONTEXT),
					source: "task.md",
				},
			}),
		}),
	],
	function* ({ documentSourceText }) {
		expect(yield* documentSourceText(questionPath)).toBe(CONTEXT);
	},
);
