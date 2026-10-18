import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
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
	screenStory.it(`renders typed document data and context at ${url}`, [], function* ({ renderRouter }) {
		const view = yield* Effect.promise(() => renderRouter(files, url, undefined));
		try {
			yield* Effect.promise(() =>
				eventually(() => expect(view.container.querySelector("article.doc a")?.getAttribute("href")).toBe("/result.md#recorded-evidence-0")),
			);
			expect(view.container.querySelector("main")?.dataset.identity).toBe("task.fixture");
			expect(view.container.querySelector(".item-introduction h1")?.id).toBe("heading-task");
			expect(view.container.querySelector("#heading-details-2")).not.toBeNull();
			expect(view.container.querySelector(".answer-reason")?.textContent).toContain("Choose a direction");
			expect(view.container.querySelector("#criterion-proof a")?.getAttribute("href")).toBe("/_board/item/result.fixture/#recorded-evidence-0");
			const backlink = view.container.querySelector('.work-context a[href="/_board/item/result.fixture/"]');
			expect(backlink?.textContent).toBe("Result");
			expect(backlink?.getAttribute("title")).toMatch(/^result\.md:\d+$/u);
			expect(view.container.querySelector(".item-summary")?.textContent).toContain("Read the evidence");
		} finally {
			yield* Effect.promise(() => view.unmount());
		}
	});
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
		function* ({ boardView }) {
			const view = boardView();

			yield* Effect.promise(() =>
				eventually(() =>
					expect(view.container.querySelector("main [role=status]")?.textContent).toContain(
						url.endsWith(".md") ? "No markdown file at missing.md." : "No item with this id",
					),
				),
			);
		},
	);
}

screenStory.it("keeps response history readable when a question's prompt template is invalid", [], function* ({ renderRouter }) {
	const question =
		'---\nid: question.invalid\nkind: question\n---\n# Invalid controls\n\n> ::::question{id="next" select="text"}\n> What next?\n> ::::\n';
	const view = yield* Effect.promise(() => renderRouter({ ...files, "question.md": question }, "/question.md", undefined));

	yield* Effect.promise(() =>
		eventually(() => expect(view.container.querySelector(".response-panel")?.textContent).toContain("Use top-level question containers")),
	);
	expect(view.container.querySelector("#response-history")?.textContent).toContain("No response is recorded");
	expect(view.container.querySelector("#response-form")).toBeNull();
});

screenStory.it("renders a document at its file URL when no home board is configured", [], function* ({ renderRouter }) {
	const view = yield* Effect.promise(() => renderRouter(files, "/home.md", { home: undefined }));
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".item-introduction h1")?.textContent).toBe("Home")));
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
