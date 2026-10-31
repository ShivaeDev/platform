import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const files = {
	"home.md": "# Home",
	"notes/task.md":
		"---\nid: task.fixture\nkind: task\nstatus: draft\n---\n# Task\n\n[Result](../result.md#recorded-evidence-0)\n\n## Details\n\n### Details\n",
	"result.md": "---\nid: result.fixture\nkind: report\n---\n# Result\n",
};

for (const url of ["/notes/task.md", "/_board/item/task.fixture/"]) {
	screenStory.it(
		`a document opened at ${url} resolves its relative links against its own folder`,
		[readingPage(files, url)],
		function* ({ documentLinks }) {
			expect(yield* documentLinks()).toEqual([["Result", "/result.md#recorded-evidence-0"]]);
		},
	);
}

screenStory.it("headings with the same title get distinct anchors", [readingPage(files, "/notes/task.md")], function* ({ headingAnchors }) {
	expect(yield* headingAnchors()).toEqual(["heading-task", "heading-details", "heading-details-2"]);
});

for (const [url, title, description] of [
	["/missing.md", "File not found", "No Markdown file at missing.md. It may have been moved or deleted."],
	["/_board/item/missing/", "Item not found", "No item has the ID missing. It may be missing, renamed, or invalid."],
] as const) {
	screenStory.it(`${url} says ${title} and offers the way back to Today and the Library`, [readingPage(files, url)], function* ({ missingPage }) {
		expect(yield* missingPage()).toEqual({
			description,
			links: [
				["Back to Today", "/"],
				["Browse the Library", "/_board/library"],
			],
			title,
		});
	});
}

const QUESTION =
	'---\nid: question.invalid\nkind: question\nscope: task\nurgency: whenever\n---\n# Invalid controls\n\n> ::::question{id="next" select="text"}\n> What next?\n> ::::\n';
screenStory.it(
	"a question with an invalid prompt template explains the problem, keeps its answer history readable and offers no answer form",
	[readingPage({ ...files, "question.md": QUESTION }, "/question.md")],
	function* ({ responseForm, responseHistory, responsePanel }) {
		yield* outcomes({
			"answer form": [responseForm(), "none"],
			"answer history": [responseHistory(), { heading: "Answers so far", text: expect.stringContaining("No answers yet") }],
			"response panel": [responsePanel(), expect.stringContaining("Use top-level question containers")],
		});
	},
);

screenStory.it(
	"a Board without a home board opens a document at its file URL",
	[readingPage(files, "/home.md", { home: undefined })],
	function* ({ shownPage }) {
		expect(yield* shownPage()).toBe("Home");
	},
);
