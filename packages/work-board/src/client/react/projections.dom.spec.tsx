import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = {
	"home.md":
		"---\nid: board.fixture\nitems: [task.fixture]\n---\n# Project board\n\nIntro.\n\n## Plans\n\nSection note.\n\n### Task\n\n[Read task](task.md)\n\n## Waiting\n\n### Task\n\nSecond card.\n\n---\n\nFooter.\n",
	"question.md":
		"---\nid: question.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\nowner: marvin\n---\n# A question\n\nChoose next.\n",
	"task.md":
		"---\nid: task.fixture\nkind: task\nstatus: draft\nowner: marvin\nnext_action: Read evidence\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# A task\n\nTask details.\n",
};

for (const { kind, text, url } of [
	{ kind: "today", text: "A question", url: "/" },
	{ kind: "board", text: "Read task", url: "/home.md" },
	{ kind: "board", text: "Read task", url: "/_board/item/board.fixture/" },
	{ kind: "work", text: "A task", url: "/_board/work?view=board" },
	{ kind: "work", text: "A task", url: "/_board/work?view=table&owner=value%3Amarvin&q=task&item=task.fixture" },
]) {
	screenStory.it(`${url} renders its content from the ${kind} projection`, [routedScreen(files, url)], function* ({ mainText, pageProjection }) {
		yield* outcomes([
			["page", () => mainText(), expect.stringContaining(text)],
			["projection", () => pageProjection(), kind],
		]);
	});
}

for (const url of ["/home.md", "/_board/item/board.fixture/"]) {
	screenStory.it(
		`The board at ${url} shows its sections as cards with their notes, counts and footer`,
		[routedScreen(files, url)],
		function* ({ boardDocument }) {
			expect(yield* boardDocument()).toEqual({
				counts: "1 plans · 1 waiting",
				footer: expect.stringContaining("Footer"),
				items: [
					{ link: "/task.md", text: "TaskRead task" },
					{ link: "none", text: "TaskSecond card." },
				],
				notes: [expect.stringContaining("Section note")],
				title: "Project board",
			});
		},
	);
}

screenStory.it(
	"A table filtered to one item opens that item beside the list",
	[routedScreen(files, "/_board/work?view=table&owner=value%3Amarvin&q=task&item=task.fixture")],
	function* ({ tableRows, workDetail }) {
		yield* outcomes([
			[
				"detail",
				() => workDetail(),
				expect.objectContaining({ document: expect.stringContaining("Task details"), summary: expect.stringContaining("Read evidence") }),
			],
			["rows", () => tableRows(), [expect.objectContaining({ id: "task.fixture" })]],
		]);
	},
);

const OUTSIDE = "/_board/work?view=board&item=question.fixture&q=task";
screenStory.it(
	"An answer being written in the selected work keeps its text and selection when the Work projection refreshes",
	[routedScreen(files, OUTSIDE, { writable: true })],
	function* ({ refreshQuery, selectText, typeText, workDetail, workDetailAnswer }) {
		yield* typeText("#work-detail #response-form textarea", "Keep my answer");
		yield* selectText("#work-detail #response-form textarea", 5, 7);
		yield* outcomes([
			["answer", () => workDetailAnswer(), { selection: [5, 7], value: "Keep my answer" }],
			["notice", () => workDetail(), expect.objectContaining({ notice: "This selected item is outside the current board or filters." })],
		]);

		yield* refreshQuery("work", { url: OUTSIDE });

		expect(yield* workDetailAnswer()).toEqual({ selection: [5, 7], value: "Keep my answer" });
	},
);
