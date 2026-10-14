import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { documentQuery } from "#client/page/routeQuery.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
});
afterEach(() => vi.unstubAllGlobals());
const files = {
	"home.md": "# Workspace\n\n## Plans\n",
	"notes/deep/review.md": "# Review\n\nThe review page.\n",
	"notes/design.md": "# Design\n\nThe design page.\n",
};
it.live("renders a fixture Board tree through the navigation query with the selected file and ancestry", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			const router = boardRouter({ api, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/deep/review.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector('#files a[aria-current="page"]')?.getAttribute("href")).toBe("/notes/deep/review.md")),
		);
		expect([...view.container.querySelectorAll("#files a")].map((link) => link.textContent)).toEqual(["home", "design", "review"]);
		expect(view.container.querySelector('#files details[data-key="folder:notes"] > summary')?.textContent).toBe("notes/ (2)");
		expect(view.container.querySelector<HTMLDetailsElement>('#files details[data-key="folder:notes/deep"]')?.open).toBe(true);
		expect(view.container.querySelector("header")).not.toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
it.live("changes the React main area through TanStack Router while retaining the mounted shell", function* () {
	let router: ReturnType<typeof boardRouter> | undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			router = boardRouter({ api, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/design.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
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
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
it.live("renders a document from its typed query with React context tools", function* () {
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			const router = boardRouter({ api, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/design.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() =>
			eventually(() => expect(view.container.querySelector("[data-react-document] article.doc")?.textContent).toContain("The design page.")),
		);
		expect(view.container.querySelector("[data-react-document] .item-context summary")?.textContent).toBe("Context and tools");
		expect(view.container.querySelector("#favorite-toggle")).not.toBeNull();
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
it.live("retains form text and focus when a hosted page query refreshes", function* () {
	const source = {
		"home.md": "# Home",
		"question.md": "---\nid: question.fixture\nkind: question\nstatus: open\n---\n# A choice\n\nChoose a direction.\n",
	};
	let refresh: (() => void) | undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(source, (api, registry) => {
			refresh = () => view.registry.refresh(documentQuery(api, "/question.md"));
			const router = boardRouter({ api, initial: "", registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/question.md"] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
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
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});

it.live("keeps the existing no-argument router available to a host", function* () {
	const router = boardRouter();
	router.update({ context: {}, history: createMemoryHistory() });
	const view = yield* Effect.promise(() => renderBoard(files, () => <RouterProvider router={router} />));
	try {
		yield* Effect.promise(() =>
			act(async () => {
				await router.navigate({ to: "/notes/design.md" });
			}),
		);
		expect(router.state.location.pathname).toBe("/notes/design.md");
		expect(view.container.textContent).toBe("");
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
