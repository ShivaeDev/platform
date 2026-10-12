import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
const files = {
	"home.md": "# Home",
	"notes/task.md":
		"---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\nnext_action: Read the evidence\ncriteria:\n  - id: proof\n    text: Show the result\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# Task\n\n[Result](../result.md#recorded-evidence-0)\n\n## Details\n\n### Details\n",
	"result.md":
		"---\nid: result.fixture\nkind: result\nevidence:\n  - criterion: task.fixture#proof\n    source: notes/task.md\n    outcome: observed\n---\n# Result\n",
};

it.live.each(["/notes/task.md", "/_board/item/task.fixture/"])(
	"renders typed document data and context at %s without querying page HTML",
	function* (url) {
		const queries: unknown[] = [];
		const view = yield* Effect.promise(() =>
			renderBoard(files, (api) => {
				const page = vi.spyOn(api.page, "query");
				queries.push(page);
				const router = boardRouter({ api, initial: "<main id='doc'>Old HTML</main>" });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
				return <RouterProvider router={router} />;
			}),
		);
		try {
			yield* Effect.promise(() =>
				eventually(() => expect(view.container.querySelector("article.doc a")?.getAttribute("href")).toBe("/result.md#recorded-evidence-0")),
			);
			expect(view.container.querySelector("[data-legacy-main]")).toBeNull();
			expect(view.container.querySelector("main")?.dataset.identity).toBe("task.fixture");
			expect(view.container.querySelector(".item-introduction h1")?.id).toBe("heading-task");
			expect(view.container.querySelector("#heading-details-2")).not.toBeNull();
			expect(view.container.querySelector("#attention-request-direction")?.textContent).toContain("Choose a direction");
			expect(view.container.querySelector("#criterion-proof a")?.getAttribute("href")).toBe("/_board/item/result.fixture/#recorded-evidence-0");
			expect(view.container.querySelector(".work-context")?.textContent).toContain("result.md");
			expect(view.container.querySelector(".item-summary")?.textContent).toContain("Read the evidence");
			for (const query of queries) {
				expect(query).not.toHaveBeenCalled();
			}
		} finally {
			yield* Effect.promise(() => view.unmount());
			vi.restoreAllMocks();
		}
	},
);

it.live.each(["/missing.md", "/_board/item/missing/"])("shows a failed initial document read at %s in React", function* (url) {
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api) => {
			const router = boardRouter({ api, initial: "" });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(view.container.querySelector("main [role=status]")?.textContent).toContain(
					url.endsWith(".md") ? "No markdown file at missing.md." : "could not be opened",
				),
			),
		);
		expect(view.container.querySelector("[data-legacy-main]")).toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("keeps response history readable when a question's prompt template is invalid", function* () {
	const question =
		'---\nid: question.invalid\nkind: question\n---\n# Invalid controls\n\n> ::::question{id="next" select="text"}\n> What next?\n> ::::\n';
	const view = yield* Effect.promise(() =>
		renderBoard({ ...files, "question.md": question }, (api) => {
			const router = boardRouter({ api, initial: "" });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/question.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector(".response-panel")?.textContent).toContain("Use top-level question containers")),
		);
		expect(view.container.querySelector("#response-history")?.textContent).toContain("No response is recorded");
		expect(view.container.querySelector("#response-form")).toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("renders the default document at the root when no home board is configured", function* () {
	let pageQuery: unknown;
	const view = yield* Effect.promise(() =>
		renderBoard(
			files,
			(api) => {
				pageQuery = vi.spyOn(api.page, "query");
				const router = boardRouter({ api, initial: "" });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/"] }) });
				return <RouterProvider router={router} />;
			},
			{ home: undefined },
		),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(".item-introduction h1")?.textContent).toBe("Home")));
		expect(view.container.querySelector("[data-legacy-main]")).toBeNull();
		expect(pageQuery).not.toHaveBeenCalled();
	} finally {
		yield* Effect.promise(() => view.unmount());
		vi.restoreAllMocks();
	}
});
