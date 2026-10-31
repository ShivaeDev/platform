import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { DENIED_DELIVERY } from "#test/boardDecisionVerbs.ts";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

const RETRY = {
	body: "Policy is now configured. **Keep the scoped checks.**",
	id: "response.retry",
	selected: ["retry"],
	text: "Preserve independent review.",
	type: "answer",
} as const;

boardFolderStory.it(
	"a published decision previews over Board HTTP as its question, source and source revision",
	[folderContains("withDependency")],
	function* ({ files, publishDecision, questionPreview }) {
		const denied = yield* publishDecision();

		expect(yield* questionPreview(denied)).toEqual({
			question: denied.questionId,
			revision: revisionOf(files.read(denied.sourcePath)),
			source: denied.sourcePath,
		});
	},
);

boardFolderStory.it(
	"a decision's respond link redirects to the answer card on its item page",
	[folderContains("withDependency")],
	function* ({ publishDecision, respondLink }) {
		const denied = yield* publishDecision();

		expect(yield* respondLink(denied)).toEqual({
			location: `/_board/item/${encodeURIComponent(denied.itemId)}/#answer-card-${encodeURIComponent(denied.request)}`,
			status: 302,
		});
	},
);

boardFolderStory.it(
	"a guided answer recorded over Board HTTP is the decision's answer with its body",
	[folderContains("withDependency")],
	function* ({ answerBody, decisionState, publishDecision, respond }) {
		const denied = yield* publishDecision();
		expect(yield* decisionState(denied)).toBe("pending");

		yield* respond(denied, RETRY);

		yield* outcomes([
			["decision", () => decisionState(denied), "answered by response.retry"],
			["answer body", () => answerBody(denied), expect.stringContaining("Keep the scoped checks")],
		]);
	},
);

boardFolderStory.it(
	"a reopened Board republishes the same decision and keeps its answer",
	[folderContains("withDependency")],
	function* ({ decisionState, publishDecision, reopenBoard, respond }) {
		const denied = yield* publishDecision();
		yield* respond(denied, RETRY);

		yield* reopenBoard();

		yield* outcomes([
			["republished decision", () => publishDecision(), denied],
			["decision", () => decisionState(denied), "answered by response.retry"],
		]);
	},
);

boardFolderStory.it(
	"publishing and answering a decision leaves the task file unchanged",
	[folderContains("withDependency")],
	function* ({ files, publishDecision, respond }) {
		const task = files.read("task.md");

		yield* respond(yield* publishDecision(), RETRY);

		expect(files.read("task.md")).toBe(task);
	},
);

for (const type of ["clarify", "not_now"] as const) {
	boardFolderStory.it(
		`a ${type} response stays the decision's answer`,
		[folderContains("withDependency")],
		function* ({ decisionState, publishDecision, respond }) {
			const denied = yield* publishDecision();

			yield* respond(denied, { body: "Which exact scope needs authority?", id: `response.${type}`, type });

			expect(yield* decisionState(denied)).toBe(`answered by response.${type}`);
		},
	);
}

boardFolderStory.it(
	"a response that supersedes an earlier one becomes the decision's answer",
	[folderContains("withDependency")],
	function* ({ decisionState, publishDecision, respond }) {
		const denied = yield* publishDecision();
		yield* respond(denied, { body: "Which exact scope needs authority?", id: "response.clarify", type: "clarify" });
		expect(yield* decisionState(denied)).toBe("answered by response.clarify");

		yield* respond(denied, { body: "Wait for policy review.", id: "response.deferred", supersedes: "response.clarify", type: "not_now" });

		expect(yield* decisionState(denied)).toBe("answered by response.deferred");
	},
);

boardFolderStory.it(
	"the newest answer from the same author wins without naming the answer it replaces",
	[folderContains("withDependency")],
	function* ({ decisionState, publishDecision, respond }) {
		const denied = yield* publishDecision();
		yield* respond(denied, { body: "Retry.", id: "response.answer", selected: ["retry"], type: "answer" });
		expect(yield* decisionState(denied)).toBe("answered by response.answer");

		yield* respond(denied, { body: "Release instead.", id: "response.resolved", selected: ["release"], type: "answer" });

		expect(yield* decisionState(denied)).toBe("answered by response.resolved");
	},
);

boardFolderStory.it(
	"an edited decision source is stale and refuses new responses",
	[folderContains("withDependency")],
	function* ({ decisionState, files, publishDecision, respond }) {
		const denied = yield* publishDecision();
		expect(yield* decisionState(denied)).toBe("pending");

		files.write(denied.sourcePath, `${files.read(denied.sourcePath)}\nChanged context.\n`);

		yield* outcomes([
			["decision", () => decisionState(denied), "stale"],
			[
				"late response",
				() => respond(denied, { body: "Old context.", id: "response.stale", type: "clarify" }),
				expect.not.stringMatching(/^accepted$/u),
			],
		]);
	},
);

boardFolderStory.it("a moved decision source is stale", [folderContains("withDependency")], function* ({ decisionState, files, publishDecision }) {
	const denied = yield* publishDecision();
	expect(yield* decisionState(denied)).toBe("pending");

	files.move(denied.sourcePath, "moved.md");

	expect(yield* decisionState(denied)).toBe("stale");
});

for (const [change, edit] of [
	["a moved task file", (files: { move: (from: string, to: string) => void }) => files.move("task.md", "moved-task.md")],
	[
		"an edited task",
		(files: { read: (file: string) => string; write: (file: string, content: string) => void }) =>
			files.write("task.md", `${files.read("task.md")}\nChanged work.\n`),
	],
] as const) {
	boardFolderStory.it(
		`a decision stays pending after ${change}`,
		[folderContains("withDependency")],
		function* ({ decisionState, files, publishDecision }) {
			const denied = yield* publishDecision(DENIED_DELIVERY);

			edit(files);

			expect(yield* decisionState(denied)).toBe("pending");
		},
	);
}
