import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { decisionFile, withGuideStatus } from "#test/answerCardFixture.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { sourceListsFixture } from "#test/sourceListsFixture.ts";

expectNoReactWarnings();

for (const [url, page] of [
	["/task.md", "Publish the guide"],
	["/goal.md", "Finish line"],
	["/_board/work", "Now"],
	["/_board/work?view=table", "Table"],
	["/_board/work?view=board", "All work"],
	["/_board/library", "Library"],
	["/", "Today"],
] as const) {
	screenStory.it(
		`${page} at ${url} adds no notes about values its items leave out`,
		[readingPage(sourceListsFixture(), url)],
		function* ({ absentValueNotes, shownPage }) {
			yield* outcomes([
				["notes", () => absentValueNotes(), []],
				["page", () => shownPage(), page],
			]);
		},
	);
}

screenStory.it(
	"a source that both relates to an item and asks about it is listed only under its more specific Attention request group",
	[readingPage(sourceListsFixture(), "/task.md")],
	function* ({ contextKinds }) {
		expect(yield* contextKinds("linked-from")).toEqual(["Attention request (4)"]);
	},
);

for (const direction of ["links-to", "linked-from"] as const) {
	screenStory.it(
		`under ${direction}, four Fleet decisions sharing one title collapse into one closed group that lists each decision once opened`,
		[readingPage(sourceListsFixture(), "/task.md")],
		function* ({ openSourceGroup, sourceGroup }) {
			expect(yield* sourceGroup(direction, "Fleet decisions (4)")).toBe("closed");

			yield* openSourceGroup(direction, "Fleet decisions (4)");

			expect(yield* sourceGroup(direction, "Fleet decisions (4)")).toEqual([0, 1, 2, 3].map((index) => `/_board/item/decision.guide.${index}/`));
		},
	);
}

const QUESTION = "Which publishing path should we take? Read the release guide.";

for (const [status, cards] of [
	["ready", [QUESTION]],
	["done", []],
	["deferred", []],
] as const) {
	for (const [url, page] of [
		["/guide.md", "Publish the install guide"],
		[`/${decisionFile}`, "Fleet decision: Publish the install guide"],
	] as const) {
		screenStory.it(
			`${page} shows ${cards.length === 0 ? "no answer card" : "the answer card"} for the managed ask on ${status} work`,
			[readingPage(withGuideStatus(status), url)],
			function* ({ answerCards, shownPage }) {
				yield* outcomes([
					["answer cards", () => answerCards(), [...cards]],
					["page", () => shownPage(), page],
				]);
			},
		);
	}
}

for (const [status, ask] of [
	["ready", "mentioned"],
	["done", "not mentioned"],
	["deferred", "not mentioned"],
] as const) {
	screenStory.it(
		`Today ${ask === "mentioned" ? "lists" : "leaves out"} the managed ask on ${status} work`,
		[readingPage(withGuideStatus(status), "/")],
		function* ({ pageMentions, shownPage }) {
			yield* outcomes([
				["ask", () => pageMentions("Which publishing path should we take?"), ask],
				["page", () => shownPage(), "Today"],
			]);
		},
	);
}

screenStory.it(
	"a closed authored question shows no answer card",
	[
		readingPage(
			{ "question.md": "---\nid: question.finished\nkind: question\nscope: task\nurgency: whenever\nstatus: done\n---\n# Previous question" },
			"/question.md",
		),
	],
	function* ({ answerCards, shownPage }) {
		yield* outcomes([
			["answer cards", () => answerCards(), []],
			["page", () => shownPage(), "Previous question"],
		]);
	},
);
