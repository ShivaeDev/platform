import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { answeredTwiceFixture, recentAnswersFixture, sharedHeadingFixture } from "#test/responseRecords.ts";
import { unreadableHome } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

const STORAGE = "Where should the project documents live?";
const KEEP_LOCAL = "Keep local files · Recommended Read and write Markdown in the project folder.";
const INBOX = routedScreen({ "home.md": "# Release plans\n", "question.md": inboxQuestion }, "/", { home: "home.md", writable: true });
const UNREADABLE = "Some files couldn't be read, so what needs you is unknown.";
const NOW = Effect.runSync(Clock.currentTimeMillis);

screenStory.it(
	"choosing an option on Today moves the question to Answered as waiting on its agent, leaving Needs you empty without offering Getting started",
	[INBOX],
	function* ({ answerOnToday, answeredRows, chooseOnToday, gettingStarted, needsYou }) {
		yield* answerOnToday(STORAGE);

		yield* chooseOnToday(KEEP_LOCAL);

		yield* outcomes([
			["answered", () => answeredRows(), [[STORAGE, "You chose Keep local files · Waiting on the agent."]]],
			["getting started", () => gettingStarted(), "not offered"],
			["needs you", () => needsYou(), "Nothing needs you"],
		]);
	},
);

screenStory.it(
	"a question changed after it was answered says it asks again and returns to Needs you",
	[INBOX],
	function* ({ answerOnToday, answeredRows, chooseOnToday, editFile, needsYou, refreshInbox }) {
		yield* answerOnToday(STORAGE);
		yield* chooseOnToday(KEEP_LOCAL);

		yield* editFile("question.md", `${inboxQuestion}\nThe shared drive is gone.\n`);
		yield* refreshInbox();

		yield* outcomes([
			["answered", () => answeredRows(), [[STORAGE, "You chose Keep local files · The question changed after the answer, so it asks again."]]],
			["needs you", () => needsYou(), [STORAGE]],
		]);
	},
);

screenStory.it(
	"Answered lists pending answers from every author and omits closed questions",
	[routedScreen(recentAnswersFixture(NOW), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		expect(yield* answeredRows()).toEqual([
			["Drop the old flag?", "reviewer chose Yes · Waiting on the agent."],
			["Keep the release branch?", "You chose Yes · Waiting on the agent."],
		]);
	},
);

for (const [workspace, files, offered] of [
	["holds no identified documents", { "notes.md": "# Notes\n" }, "offered"],
	["holds identified work", { "task.md": "---\nid: task.done\nkind: task\nstatus: done\n---\n# Finished task\n" }, "not offered"],
] as const) {
	screenStory.it(
		`an empty Needs you offers Getting started only when the workspace ${workspace}`,
		[routedScreen(files, "/")],
		function* ({ gettingStarted, needsYou }) {
			yield* outcomes([
				["getting started", () => gettingStarted(), offered],
				["needs you", () => needsYou(), "Nothing needs you"],
			]);
		},
	);
}

screenStory.it(
	"Today links the home document by its own title, while the location trail still calls the whole Board Workspace",
	[routedScreen({ "home.md": "# Release plans\n" }, "/", { home: "home.md" })],
	function* ({ fileLocation, todayHomeLink }) {
		yield* outcomes([
			["home link", () => todayHomeLink(), { href: "/home.md", text: "Release plans" }],
			["location trail", () => fileLocation(), "Workspace/ Today"],
		]);
	},
);

screenStory.it(
	"while a workspace file can't be read, Today says what needs you is unknown and lists no answers",
	[screenFiles(recentAnswersFixture(NOW), { home: "home.md" }), unreadableHome(), openScreen()],
	function* ({ answeredRows, needsYou }) {
		yield* outcomes([
			["answered", () => answeredRows(), []],
			["needs you", () => needsYou(), UNREADABLE],
		]);
	},
);

screenStory.it(
	"answers about the same item are told apart by a question label that never repeats the item's title, then by request ID",
	[routedScreen(sharedHeadingFixture(NOW), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		expect(yield* answeredRows()).toEqual([
			["Ship the release", "How should we proceed? · notes-blocked · You chose Retry · Waiting on the agent."],
			["Ship the release", "How should we proceed? · review-stale · You chose Retry · Waiting on the agent."],
			[
				"Ship the release",
				"The changelog wording for the release reads as a breaking change, although every… · You answered · Waiting on the agent.",
			],
			["Ship the release", "You answered · Waiting on the agent."],
		]);
	},
);

screenStory.it(
	"when two people answered the same question, Answered shows only the latest answer",
	[routedScreen(answeredTwiceFixture(NOW), "/", { home: "home.md" })],
	function* ({ answeredRows }) {
		expect(yield* answeredRows()).toEqual([["Keep the beta flag?", "You chose No · Waiting on the agent."]]);
	},
);
