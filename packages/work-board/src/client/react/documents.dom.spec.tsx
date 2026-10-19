import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen, routedScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";

expectNoReactWarnings();
const files = {
	"home.md": "# Home",
	"notes/task.md":
		"---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\nnext_action: Read the evidence\ncriteria:\n  - id: proof\n    text: Show the result\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# Task\n\n[Result](../result.md#recorded-evidence-0)\n\n## Details\n\n### Details\n",
	"result.md":
		"---\nid: result.fixture\nkind: result\nevidence:\n  - criterion: task.fixture#proof\n    source: notes/task.md\n    outcome: observed\n---\n# Result\n",
};

for (const url of ["/notes/task.md", "/_board/item/task.fixture/"]) {
	screenStory.it(
		`renders typed document data and context at ${url}`,
		[routedScreen(files, url, undefined)],
		function* ({ readAttribute, findElement, readText }) {
			yield* Effect.promise(() => eventually(() => expect(readAttribute("article.doc a", "href")).toBe("/result.md#recorded-evidence-0")));
			expect(findElement("main")?.dataset.identity).toBe("task.fixture");
			expect(findElement(".item-introduction h1")?.id).toBe("heading-task");
			expect(findElement("#heading-details-2")).not.toBeNull();
			expect(readText(".answer-reason")).toContain("Choose a direction");
			expect(readAttribute("#criterion-proof a", "href")).toBe("/_board/item/result.fixture/#recorded-evidence-0");
			const backlink = findElement('.work-context a[href="/_board/item/result.fixture/"]');
			expect(backlink?.textContent).toBe("Result");
			expect(backlink?.getAttribute("title")).toMatch(/^result\.md:\d+$/u);
			expect(readText(".item-summary")).toContain("Read the evidence");
		},
	);
}

for (const url of ["/missing.md", "/_board/item/missing/"]) {
	screenStory.it(
		`shows a failed initial document read at ${url} in React`,
		[
			boardScreen(files, (api, registry) => {
				const router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
				return <RouterProvider router={router} />;
			}),
		],
		function* ({ readText }) {
			yield* Effect.promise(() =>
				eventually(() =>
					expect(readText("main [role=status]")).toContain(url.endsWith(".md") ? "No markdown file at missing.md." : "No item with this id"),
				),
			);
		},
	);
}

const QUESTION =
	'---\nid: question.invalid\nkind: question\n---\n# Invalid controls\n\n> ::::question{id="next" select="text"}\n> What next?\n> ::::\n';
screenStory.it(
	"keeps response history readable when a question's prompt template is invalid",
	[routedScreen({ ...files, "question.md": QUESTION }, "/question.md", undefined)],
	function* ({ readText, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(readText(".response-panel")).toContain("Use top-level question containers")));
		expect(readText("#response-history")).toContain("No responses yet");
		expect(findElement("#response-form")).toBeNull();
	},
);

screenStory.it(
	"renders a document at its file URL when no home board is configured",
	[routedScreen(files, "/home.md", { home: undefined })],
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText(".item-introduction h1")).toBe("Home")));
	},
);
