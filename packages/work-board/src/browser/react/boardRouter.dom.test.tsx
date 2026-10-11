import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { expect, it } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { setupResponses } from "#browser/responses/setup.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
const files = {
	"home.md": "# Workspace\n\n## Plans\n",
	"notes/deep/review.md": "# Review\n\nThe review page.\n",
	"notes/design.md": "# Design\n\nThe design page.\n",
};
it("renders a fixture Board tree through the navigation query with the selected file and ancestry", async () => {
	const view = await renderBoard(files, (api) => {
		const router = boardRouter({ api, initial: "" });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/deep/review.md"] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelector('#files a[aria-current="page"]')?.getAttribute("href")).toBe("/notes/deep/review.md"));
		expect([...view.container.querySelectorAll("#files a")].map((link) => link.textContent)).toEqual(["home", "design", "review"]);
		expect(view.container.querySelector('#files details[data-key="folder:notes"] > summary')?.textContent).toBe("notes/ (2)");
		expect(view.container.querySelector<HTMLDetailsElement>('#files details[data-key="folder:notes/deep"]')?.open).toBe(true);
		expect(view.container.querySelector("header.bar")).not.toBeNull();
	} finally {
		await view.unmount();
	}
});
it("changes the hosted main area through TanStack Router while retaining the mounted shell", async () => {
	let router: ReturnType<typeof boardRouter> | undefined;
	const view = await renderBoard(files, (api) => {
		router = boardRouter({ api, initial: "" });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/design.md"] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Design"));
		const header = view.container.querySelector("header.bar");
		const host = view.container.querySelector("[data-legacy-main]");
		await act(async () => {
			await router?.navigate({ to: "/notes/deep/review.md" });
		});
		await eventually(() => expect(view.container.querySelector("#doc h1")?.textContent).toBe("Review"));
		expect(view.container.querySelector("header.bar")).toBe(header);
		expect(view.container.querySelector("[data-legacy-main]")).toBe(host);
		expect(router?.state.location.pathname).toBe("/notes/deep/review.md");
	} finally {
		await view.unmount();
	}
});
it("renders an unmigrated document through LegacyMain with the existing server-rendered tools", async () => {
	const view = await renderBoard(files, (api) => {
		const router = boardRouter({ api, initial: "" });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/notes/design.md"] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelector("[data-legacy-main] #doc article.doc")?.textContent).toContain("The design page."));
		expect(view.container.querySelector("[data-legacy-main] .item-context summary")?.textContent).toBe("Context and tools");
		expect(view.container.querySelector("#favorite-toggle")).not.toBeNull();
	} finally {
		await view.unmount();
	}
});
it("retains form text and focus when a hosted page query refreshes", async () => {
	const source = {
		"home.md": "# Home",
		"question.md": "---\nid: question.fixture\nkind: question\nstatus: open\n---\n# A choice\n\nChoose a direction.\n",
	};
	let refresh: (() => void) | undefined;
	const view = await renderBoard(source, (api) => {
		refresh = () => view.registry.refresh(api.page.query({ url: "/question.md" }));
		const router = boardRouter({ api, initial: "" });
		router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: ["/question.md"] }) });
		return <RouterProvider router={router} />;
	});
	try {
		await eventually(() => expect(view.container.querySelector("#response-form textarea")).not.toBeNull());
		const body = view.container.querySelector<HTMLTextAreaElement>("#response-form textarea");
		if (!body) {
			throw new Error("Missing response text");
		}
		setupResponses();
		body.value = "Work in progress";
		body.dispatchEvent(new Event("input", { bubbles: true }));
		body.focus();
		body.setSelectionRange(4, 8, "backward");
		source["question.md"] += "\nMore context.\n";
		await act(async () => refresh?.());
		await eventually(() => expect(view.container.querySelector("#doc")?.textContent).toContain("More context."));
		expect(view.container.querySelector<HTMLTextAreaElement>("#response-form textarea")?.value).toBe("Work in progress");
		const updated = view.container.querySelector<HTMLTextAreaElement>("#response-form textarea");
		expect(document.activeElement).toBe(updated);
		expect([updated?.selectionStart, updated?.selectionEnd, updated?.selectionDirection]).toEqual([4, 8, "backward"]);
	} finally {
		await view.unmount();
	}
});

it("keeps the existing no-argument router available to a host", async () => {
	const router = boardRouter();
	router.update({ context: {}, history: createMemoryHistory() });
	const view = await renderBoard(files, () => <RouterProvider router={router} />);
	try {
		await act(async () => {
			await router.navigate({ to: "/notes/design.md" });
		});
		expect(router.state.location.pathname).toBe("/notes/design.md");
		expect(view.container.textContent).toBe("");
	} finally {
		await view.unmount();
	}
});
