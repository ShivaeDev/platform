import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routeQueryOptions } from "./routeQuery.ts";

expectNoReactWarnings();
beforeEach(() => {
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
for (const { kind, query, field, url, source: content } of cases) {
	screenStory.it(`retains ${query} ${field} draft, source notice and caret through query refresh and reload`, [], function* ({ renderRouter }) {
		const files = { "home.md": "# Home", "task.md": content };
		let refresh: (() => void) | undefined;
		function open() {
			return renderRouter(files, url, undefined, (api, registry) => {
				refresh = () =>
					query === "document"
						? registry.refresh(api.document.query({ url }, routeQueryOptions))
						: registry.refresh(api.handoff.query({ url }, routeQueryOptions));
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
		const first = yield* Effect.promise(() => open());
		try {
			yield* Effect.promise(() => eventually(() => expect(document.getElementById(`${kind}-form`)).not.toBeNull()));
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
			yield* Effect.promise(() => act(async () => refresh?.()));
			yield* Effect.promise(() => eventually(() => expect(notice()).toContain("Source changed")));
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
			yield* Effect.promise(() => first.unmount());
		}
		yield* Effect.promise(() => open());

		yield* Effect.promise(() => eventually(() => expect(notice()).toContain("Source changed")));
		const input = control();
		expect(input.value).toBe("Direction in progress");
		const details = input.closest("details");
		if (details) {
			expect(details.open).toBe(true);
		}
		expect(document.activeElement).toBe(input);
		expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([4, 9, "backward"]);
		expect(document.getElementById(`${kind}-submit`)).toHaveProperty("disabled", true);
	});
}
