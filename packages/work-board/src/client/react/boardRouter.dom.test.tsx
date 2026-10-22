import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
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
	"renders compact navigation and the selected document title",
	[routedScreen(files, "/notes/deep/review.md")],
	function* ({ readText, findElement, count }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Review")));
		expect(findElement("#files")).toBeNull();
		expect(count("#primary-navigation a")).toBe(6);
		expect(findElement("header")).not.toBeNull();
	},
);
screenStory.it(
	"changes the main area through the router while retaining the shell",
	[routedScreen(files, "/notes/design.md")],
	function* ({ readText, findElement, navigate, location }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Design")));
		const header = findElement("header");
		const host = findElement("main[data-react-document]");
		yield* Effect.promise(() => navigate("/notes/deep/review.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Review")));
		expect(findElement("header")).toBe(header);
		expect(findElement("main[data-react-document]")).toBe(host);
		expect(location()?.pathname).toBe("/notes/deep/review.md");
	},
);
screenStory.it(
	"renders a document from its typed query with React context tools",
	[routedScreen(files, "/notes/design.md")],
	function* ({ readText, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(readText("article.doc")).toContain("The design page.")));
		expect(findElement(".document-outline")).not.toBeNull();
	},
);
const QUESTION = "---\nid: question.fixture\nkind: question\nscope: task\nurgency: whenever\nstatus: ready\n---\n# A choice\n\nChoose a direction.\n";
screenStory.it(
	"retains form text and focus when a hosted page query refreshes",
	[routedScreen({ "home.md": "# Home", "question.md": QUESTION }, "/question.md", { home: "home.md", writable: true })],
	function* ({ findElement, readText, readFocus, typeText, selectText, editFile, refreshDocument }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form textarea")).not.toBeNull()));
		typeText("#response-form textarea", "Work in progress");
		selectText("#response-form textarea", 4, 8, "backward");
		editFile("question.md", `${QUESTION}\nMore context.\n`);
		yield* Effect.promise(() => refreshDocument("/question.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc")).toContain("More context.")));
		const updated = findElement<HTMLTextAreaElement>("#response-form textarea");
		expect(updated?.value).toBe("Work in progress");
		expect(readFocus()).toBe(updated);
		expect([updated?.selectionStart, updated?.selectionEnd, updated?.selectionDirection]).toEqual([4, 8, "backward"]);
	},
);
screenStory.it("keeps the no-argument router available to a host", [emptyHostRouter(files)], function* ({ navigate, location, readText }) {
	yield* Effect.promise(() => navigate("/notes/design.md"));
	expect(location()?.pathname).toBe("/notes/design.md");
	expect(readText()).toBe("");
});
