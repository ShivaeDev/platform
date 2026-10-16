import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { browserStorage } from "#test/browserStorage.ts";
import { renderBoard } from "#test/react.tsx";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
	document.documentElement.dataset.workspace = "forms-fixture";
});
afterEach(() => {
	delete document.documentElement.dataset.workspace;
	vi.unstubAllGlobals();
});
const SOURCE =
	"---\nid: task.fixture\nkind: task\nnext_action: Inspect the proof\nattention:\n - id: direction\n   kind: decision\n   state: open\n   reason: Choose a direction\n   response_from: [maintainer]\n   unblocks: [task.fixture]\n---\n# A task\n\nTask context.\n";
const cases = [
	{ field: '[name="body"]', kind: "response", query: "document" as const, source: SOURCE, url: "/_board/item/task.fixture/" },
	{
		field: '[data-prompt="answer"] textarea',
		kind: "response",
		query: "document" as const,
		source:
			"---\nid: task.fixture\nkind: question\nstatus: open\noptions:\n - label: Keep files\n   description: Keep direction local\n---\n# Which direction?\n",
		url: "/_board/item/task.fixture/",
	},
	{
		field: '[name="body"]',
		kind: "response",
		query: "document" as const,
		source:
			"---\nid: task.fixture\nkind: question\nstatus: open\noptions:\n - label: Keep files\n   description: Keep direction local\n---\n# Which direction?\n",
		url: "/_board/item/task.fixture/",
	},
	{ field: '[name="goal"]', kind: "handoff", query: "handoff" as const, source: SOURCE, url: "/_board/handoff?item=task.fixture" },
];
it.each(cases)(
	"retains $query $field draft, source notice and caret through query refresh and reload",
	async ({ kind, query, field, url, source: content }) => {
		const files = { "home.md": "# Home", "task.md": content };
		let refresh: (() => void) | undefined;
		function open() {
			return renderBoard(files, (api, registry) => {
				refresh = () =>
					query === "document"
						? registry.refresh(api.document.query({ url }, routeQueryOptions))
						: registry.refresh(api.handoff.query({ url }, routeQueryOptions));
				const router = boardRouter({ api, registry });
				router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
				return <RouterProvider router={router} />;
			});
		}
		function control() {
			const input = document.querySelector<HTMLTextAreaElement>(`#${kind}-form ${field}`);
			if (!input) {
				throw new Error("Missing draft control");
			}
			return input;
		}
		function notice() {
			return document.getElementById(`${kind}-status`)?.textContent;
		}
		const first = await open();
		try {
			await eventually(() => expect(document.getElementById(`${kind}-form`)).not.toBeNull());
			const input = control();
			act(() => {
				input.value = "Direction in progress";
				input.dispatchEvent(new Event("input", { bubbles: true }));
			});
			act(() => {
				const details = input.closest("details");
				if (details) {
					details.open = true;
				}
				input.focus();
				input.setSelectionRange(4, 9, "backward");
			});
			files["task.md"] += "\nChanged source context.\n";
			await act(async () => refresh?.());
			await eventually(() => expect(notice()).toContain("Source changed"));
			expect(control()).toBe(input);
			expect(input.value).toBe("Direction in progress");
			const details = input.closest("details");
			if (details) {
				expect(details.open).toBe(true);
			}
			expect(document.activeElement).toBe(input);
			expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([4, 9, "backward"]);
			act(() => window.dispatchEvent(new Event("pagehide")));
		} finally {
			await first.unmount();
		}
		const reloaded = await open();
		try {
			await eventually(() => expect(notice()).toContain("Source changed"));
			const input = control();
			expect(input.value).toBe("Direction in progress");
			const details = input.closest("details");
			if (details) {
				expect(details.open).toBe(true);
			}
			expect(document.activeElement).toBe(input);
			expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([4, 9, "backward"]);
			expect(document.getElementById(`${kind}-submit`)).toHaveProperty("disabled", true);
		} finally {
			await reloaded.unmount();
		}
	},
);
