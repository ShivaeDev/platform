import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";
import { refusal } from "#test/refusal.ts";

const DENIED = {
	id: "fleet.denied",
	links: ["https://example.test/pr/1"],
	reason: "Delivery authority is denied",
	recommendation: "Approve exact scope through trusted runtime policy",
};

boardFolderStory.it("a task brief reads its dependencies, areas, status and body", [folderContains("withDependency")], function* ({ readBrief }) {
	expect(yield* readBrief("task.one")).toMatchObject({
		areas: ["work-fleet/host", "work-board/ui"],
		context: expect.stringContaining("# Useful work"),
		dependsOn: ["task.before"],
		status: "done",
	});
});

boardFolderStory.it(
	"publishing the same decision twice returns one receipt and writes one source and one question",
	[folderContains("withDependency")],
	function* ({ publishDecision, root }) {
		const first = yield* publishDecision(DENIED);

		const second = yield* publishDecision(DENIED);

		expect(second).toEqual(first);
		expect(readdirSync(join(root, "responses")).toSorted((left, right) => left.localeCompare(right))).toEqual(
			[`${first.questionId}.md`, first.sourcePath.replace("responses/", "")].toSorted((left, right) => left.localeCompare(right)),
		);
	},
);

boardFolderStory.it(
	"a published decision offers retry and release, asks for the item with its reason and leaves out the recommendation",
	[folderContains("withDependency")],
	function* ({ decisionState, publishDecision, publishedQuestion }) {
		const denied = yield* publishDecision(DENIED);

		yield* outcomes([
			[
				"published question",
				() => publishedQuestion(denied),
				{
					item: denied.itemId,
					options: ["retry", "release"],
					questionReason: expect.stringContaining(DENIED.reason),
					source: expect.not.stringContaining(DENIED.recommendation),
				},
			],
			["decision", () => decisionState(denied), "pending"],
		]);
	},
);

boardFolderStory.it("a task id that two files share is refused", [folderContains("ambiguousIdentity")], function* ({ readBrief }) {
	expect(yield* refusal(readBrief("same"))).toMatch(/^Board failure: /u);
});
