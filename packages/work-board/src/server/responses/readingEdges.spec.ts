import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { questionRegistered } from "#test/questionRecordTraits.ts";

boardStory.it("asking for a request the item does not have is refused as not found", [aQuestionnaire()], function* ({ questionPreview }) {
	expect(yield* questionPreview("investigation.choices", "absent")).toBe(
		"not found: The exact open attention request is missing, ambiguous or unavailable.",
	);
});

boardStory.it(
	"registering a question whose source exceeds 256 KiB of UTF-8 is refused",
	[aQuestionnaire(`${questionnaireSource}\n${"💬".repeat((256 * 1024) / 4)}`)],
	function* ({ registerQuestion }) {
		expect(yield* registerQuestion()).toBe("bad request: Question context is limited to 256 KiB; use a focused source document.");
	},
);

boardStory.it(
	"registering a questionnaire with an option that has no description is refused",
	[aQuestionnaire(questionnaireSource.replace("**Latest reply** — compact, with older replies behind a link.", ""))],
	function* ({ registerQuestion }) {
		expect(yield* registerQuestion()).toBe(
			"bad request: Invalid response template: Options need Markdown descriptions and cannot nest response controls.",
		);
	},
);

boardStory.it(
	"reading replies to a project item as if it were a registered question is refused",
	[aQuestionnaire()],
	function* ({ repliesToIdentity }) {
		expect(yield* repliesToIdentity("investigation.choices")).toBe(
			"conflict: This identity is not a valid registered question; response history is unknown.",
		);
	},
);

boardStory.it(
	"asking for the reply after one that was never recorded is refused",
	[aQuestionnaire(), questionRegistered()],
	function* ({ nextReply }) {
		expect(yield* nextReply("response.absent")).toBe("not found: The next-response cursor is not recorded for this question.");
	},
);

boardStory.it(
	"a registered question an outside writer adds with more than 256 KiB of context cannot be read",
	[aQuestionnaire(), questionRegistered()],
	function* ({ outsideWriterAddsOversizedQuestion, replyHistory }) {
		yield* outsideWriterAddsOversizedQuestion();

		expect(yield* replyHistory()).toBe("bad request: The registered context exceeds the 256 KiB limit.");
	},
);

boardStory.it(
	"a reply an outside writer adds with more than 32768 characters makes the history unreadable",
	[aQuestionnaire(), questionRegistered()],
	function* ({ outsideWriterAddsReply, replyHistory }) {
		yield* outsideWriterAddsReply("responses/response.edge.md", "response.edge", "x".repeat(32_769));

		expect(yield* replyHistory()).toBe("bad request: A recorded response exceeds the supported text limit; read its source file directly.");
	},
);

boardStory.it(
	"a reply identity an outside writer duplicates selects no answer",
	[aQuestionnaire(), questionRegistered()],
	function* ({ outsideWriterAddsReply, replyHistory }) {
		yield* outsideWriterAddsReply("responses/response.edge.md", "response.edge");
		expect(yield* replyHistory()).toEqual(["response.edge"]);

		yield* outsideWriterAddsReply("duplicate.md", "response.edge");

		expect(yield* replyHistory()).toBe("conflict: A response identity is duplicated; no answer is selected.");
	},
);

boardStory.it(
	"no reply is selected while a workspace file cannot be read",
	[aQuestionnaire(), questionRegistered()],
	function* ({ replyHistory, sourceBecomesUnreadable }) {
		expect(yield* replyHistory()).toEqual([]);

		yield* sourceBecomesUnreadable("task.md");

		expect(yield* replyHistory()).toBe("unavailable: The workspace index is incomplete; no response can be selected safely.");
	},
);

boardStory.it(
	"replies recorded at the same moment are ordered by identity, and the next-reply cursor follows that order",
	[aQuestionnaire(), questionRegistered()],
	function* ({ nextReply, outsideWriterAddsReply, replyHistory }) {
		yield* outsideWriterAddsReply("responses/first.md", "response.z");
		yield* outsideWriterAddsReply("responses/second.md", "response.a");

		yield* outcomes([
			["first reply", () => nextReply(), "response.a"],
			["history", () => replyHistory(), ["response.a", "response.z"]],
			["reply after response.a", () => nextReply("response.a"), "response.z"],
		]);
	},
);
