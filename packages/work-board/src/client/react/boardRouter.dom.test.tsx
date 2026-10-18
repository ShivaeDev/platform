import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { boardRouter } from "./boardRouter.ts";
import { documentQuery } from "./routeQuery.ts";

expectNoReactWarnings();
afterEach(() => vi.unstubAllGlobals());
const files = {
	"home.md": "# Workspace\n\n## Plans\n",
	"notes/deep/review.md": "# Review\n\nThe review page.\n",
	"notes/design.md": "# Design\n\nThe design page.\n",
};
screenStory.it(
	"renders compact navigation and the selected document title",
	[
		boardScreen(files, (api, registry) => {
			const router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/deep/review.md"] }) });
			return <RouterProvider router={router} />;
		}),
	],
	function* ({ boardView }) {
		const view = boardView();

		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector('section[aria-label="Recent"] a[aria-current="page"]')?.textContent).toBe("Review")),
		);
		expect(view.container.querySelector("#files")).toBeNull();
		expect(view.container.querySelectorAll("#primary-navigation a")).toHaveLength(5);
		expect(view.container.querySelector("header")).not.toBeNull();
	},
);
screenStory.it("changes the React main area through TanStack Router while retaining the mounted shell", [], function* ({ renderBoard }) {
	let router: ReturnType<typeof boardRouter> | undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/design.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);

	yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Design")));
	const header = view.container.querySelector("header");
	const host = view.container.querySelector("main[data-react-document]");
	yield* Effect.promise(() =>
		act(async () => {
			await router?.navigate({ to: "/notes/deep/review.md" });
		}),
	);
	yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Review")));
	expect(view.container.querySelector("header")).toBe(header);
	expect(view.container.querySelector("main[data-react-document]")).toBe(host);
	expect(router?.state.location.pathname).toBe("/notes/deep/review.md");
});
screenStory.it(
	"renders a document from its typed query with React context tools",
	[
		boardScreen(files, (api, registry) => {
			const router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/design.md"] }) });
			return <RouterProvider router={router} />;
		}),
	],
	function* ({ boardView }) {
		const view = boardView();

		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector("[data-react-document] article.doc")?.textContent).toContain("The design page.")),
		);
		expect(view.container.querySelector("[data-react-document] .item-context [role=tab][aria-selected=true]")?.textContent).toBe("Details");
		expect(view.container.querySelector("#favorite-toggle")).not.toBeNull();
	},
);
screenStory.it("retains form text and focus when a hosted page query refreshes", [], function* ({ renderRouter }) {
	const source = {
		"home.md": "# Home",
		"question.md": "---\nid: question.fixture\nkind: question\nstatus: open\n---\n# A choice\n\nChoose a direction.\n",
	};
	let refresh: (() => void) | undefined;
	const view = yield* Effect.promise(() =>
		renderRouter(source, "/question.md", undefined, (api) => {
			refresh = () => view.registry.refresh(documentQuery(api, "/question.md"));
		}),
	);

	yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form textarea")).not.toBeNull()));
	const body = view.container.querySelector<HTMLTextAreaElement>("#response-form textarea");
	if (!body) {
		throw new Error("Missing response text");
	}
	act(() => {
		body.value = "Work in progress";
		body.dispatchEvent(new Event("input", { bubbles: true }));
	});
	body.focus();
	body.setSelectionRange(4, 8, "backward");
	source["question.md"] += "\nMore context.\n";
	yield* Effect.promise(() => act(async () => refresh?.()));
	yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#doc")?.textContent).toContain("More context.")));
	expect(view.container.querySelector<HTMLTextAreaElement>("#response-form textarea")?.value).toBe("Work in progress");
	const updated = view.container.querySelector<HTMLTextAreaElement>("#response-form textarea");
	expect(document.activeElement).toBe(updated);
	expect([updated?.selectionStart, updated?.selectionEnd, updated?.selectionDirection]).toEqual([4, 8, "backward"]);
});

screenStory.it("keeps the existing no-argument router available to a host", [], function* ({ renderBoard }) {
	const router = boardRouter();
	router.update({ context: {}, history: createMemoryHistory() });
	const view = yield* Effect.promise(() => renderBoard(files, () => <RouterProvider router={router} />));

	yield* Effect.promise(() =>
		act(async () => {
			await router.navigate({ to: "/notes/design.md" });
		}),
	);
	expect(router.state.location.pathname).toBe("/notes/design.md");
	expect(view.container.textContent).toBe("");
});
