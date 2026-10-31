import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { emptyHostRouter } from "#test/emptyHostRouter.tsx";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const files = {
	"home.md": "# Workspace\n\n## Plans",
	"notes/deep/review.md": "# Review\n\nThe review page.",
	"notes/design.md": "# Design\n\nThe design page.\n\n## Decisions\n",
};

screenStory.it(
	"opens a nested document beside the shell's six destinations",
	[routedScreen(files, "/notes/deep/review.md")],
	function* ({ mainHeading, sidebarDestinations }) {
		yield* outcomes({
			"the destinations": [
				sidebarDestinations(),
				["Today", "Goals", "Now", "Pull requests", "Library", "System"].map((label) => expect.objectContaining({ label })),
			],
			"the heading": [mainHeading(), "Review"],
		});
	},
);

screenStory.it(
	"swaps only the page when the router opens another document, keeping the header and main area",
	[routedScreen(files, "/notes/design.md")],
	function* ({ currentPage, mainHeading, markShell, navigate, shellParts }) {
		yield* markShell();
		expect(yield* mainHeading()).toBe("Design");

		yield* navigate("/notes/deep/review.md");

		yield* outcomes({
			"the heading": [mainHeading(), "Review"],
			"the page": [currentPage(), "/notes/deep/review.md"],
			"the shell": [shellParts(), { header: "kept", main: "kept", projection: "none" }],
		});
	},
);

screenStory.it("renders a document's text with its outline", [routedScreen(files, "/notes/design.md")], function* ({ pageOutline, pageText }) {
	yield* outcomes({
		"the outline": [pageOutline(), ["Design", "Decisions"]],
		"the page": [pageText(), expect.stringContaining("The design page.")],
	});
});

const QUESTION = "---\nid: question.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\n---\n# A choice\n\nChoose a direction.\n";

screenStory.it(
	"keeps a drafted answer, its focus and its selection when the question page refreshes",
	[routedScreen({ "home.md": "# Home", "question.md": QUESTION }, "/question.md", { home: "home.md", writable: true })],
	function* ({ editFile, focusedField, pageText, refreshDocument, typeAnswerAndSelect }) {
		yield* typeAnswerAndSelect("Work in progress", 4, 8, "backward");
		yield* editFile("question.md", `${QUESTION}\nMore context.\n`);
		expect(yield* pageText()).not.toContain("More context.");

		yield* refreshDocument("/question.md");

		yield* outcomes({
			"the answer field": [focusedField(), { selection: [4, 8, "backward"], value: "Work in progress" }],
			"the page": [pageText(), expect.stringContaining("More context.")],
		});
	},
);

screenStory.it("lets a host use the Board router without Board context", [emptyHostRouter(files)], function* ({ currentPage, navigate, pageText }) {
	yield* navigate("/notes/design.md");

	yield* outcomes({
		"the page": [currentPage(), "/notes/design.md"],
		"the screen": [pageText(), ""],
	});
});
