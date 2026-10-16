import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { act } from "react";
import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
const files = {
	"home.md":
		"---\nid: board.fixture\nkind: board\nitems: [task.fixture]\n---\n# Project board\n\nIntro.\n\n## Plans\n\nSection note.\n\n### Task\n\n[Read task](task.md)\n\n## Waiting\n\n### Task\n\nSecond card.\n\n---\n\nFooter.\n",
	"question.md": "---\nid: question.fixture\nkind: question\nstatus: open\nowner: reader\n---\n# A question\n\nChoose next.\n",
	"task.md":
		"---\nid: task.fixture\nkind: task\nstatus: planned\nowner: reader\nnext_action: Read evidence\nattention:\n  - id: direction\n    kind: decision\n    reason: Choose a direction\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.fixture]\n---\n# A task\n\nTask details.\n",
};
const routes = [
	{ kind: "today", selector: "#needs-you", text: "A question", url: "/" },
	{ kind: "board", selector: ".board .item", text: "Read task", url: "/home.md" },
	{ kind: "board", selector: ".board .item", text: "Read task", url: "/_board/item/board.fixture/" },
	{ kind: "work", selector: ".work-card[data-item='task.fixture']", text: "A task", url: "/_board/work?view=board" },
	{ kind: "work", selector: ".work-table", text: "A task", url: "/_board/work?view=table&owner=value%3Areader&q=task&item=task.fixture" },
];
it.live.each(routes)("renders $url from its typed projection without requesting HTML", function* ({ url, selector, text, kind }) {
	let page: unknown;
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			page = vi.spyOn(api.page, "query");
			const router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector(selector)?.textContent).toContain(text)));
		expect(view.container.querySelector("[data-legacy-main]")).toBeNull();
		expect(view.container.querySelector("main")?.dataset.projection).toBe(kind);
		expect(page).not.toHaveBeenCalled();
		if (kind === "board") {
			expect(view.container.querySelector(".item-introduction h1")?.textContent).toBe("Project board");
			expect(view.container.querySelector(".item-introduction")?.classList.contains("sticky")).toBe(true);
			expect(view.container.querySelector('.document-outline a[href="#heading-plans"]')).not.toBeNull();
			expect(view.container.querySelector(".board .notes")?.textContent).toContain("Section note");
			expect(view.container.querySelector(".counts")?.textContent).toBe("1 plans · 1 waiting");
			expect(view.container.querySelector("footer")?.textContent).toContain("Footer");
			expect(view.container.querySelector("#heading-task-2")).not.toBeNull();
			expect(view.container.querySelector(".item a[href='/task.md']")).not.toBeNull();
		}
		if (url.includes("item=task.fixture")) {
			expect(view.container.querySelectorAll(".work-table tbody tr")).toHaveLength(1);
			yield* Effect.promise(() =>
				eventually(() => expect(view.container.querySelector("#work-detail article.doc")?.textContent).toContain("Task details")),
			);
			expect(view.container.querySelector("#work-detail .item-summary")?.textContent).toContain("Read evidence");
		}
	} finally {
		yield* Effect.promise(() => view.unmount());
		vi.restoreAllMocks();
	}
});

it.live("retains inline answer edits and selected detail through a Work projection refresh", function* () {
	let refresh: (() => void) | undefined;
	let page: unknown;
	const url = "/_board/work?view=board&item=question.fixture&q=task";
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			page = vi.spyOn(api.page, "query");
			refresh = () => registry.refresh(api.work.query({ url }, routeQueryOptions));
			const router = boardRouter({ api, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
			return <RouterProvider router={router} />;
		}),
	);
	try {
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("#response-form textarea")).not.toBeNull()));
		expect(view.container.querySelector(".detail-notice")?.textContent).toContain("outside the current board or filters");
		const body = view.container.querySelector<HTMLTextAreaElement>("#response-form textarea");
		if (!body) {
			throw new Error("Missing answer textarea");
		}
		act(() => {
			body.value = "Keep my answer";
			body.dispatchEvent(new Event("input", { bubbles: true }));
		});
		body.focus();
		body.setSelectionRange(5, 7);
		yield* Effect.promise(() => act(async () => refresh?.()));
		yield* Effect.promise(() => eventually(() => expect(view.container.querySelector("main")?.dataset.route).toBe(url)));
		expect(view.container.querySelector("#response-form textarea")).toBe(body);
		expect(body.value).toBe("Keep my answer");
		expect(body.selectionStart).toBe(5);
		expect(body.selectionEnd).toBe(7);
		expect(page).not.toHaveBeenCalled();
	} finally {
		yield* Effect.promise(() => view.unmount());
		vi.restoreAllMocks();
	}
});
