import { Effect } from "effect";
import { act } from "react";
import { expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { SearchDialog } from "#client/react/SearchDialog.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it("selects and opens the remaining result when a query refresh removes the selected third result", [], function* ({ renderBoard }) {
	const files = {
		"notes/first.md": "# First\n\nShared phrase one.\n",
		"notes/second.md": "# Second\n\nShared phrase two.\n",
		"notes/third.md": "# Third\n\nShared phrase three.\n",
	};
	const close = vi.fn();
	let refresh: (() => void) | undefined;
	const view = yield* Effect.promise(() =>
		renderBoard(files, (api, registry) => {
			refresh = () => registry.refresh(api.search.query({ query: "Shared phrase" }));
			return (
				<SearchDialog
					api={api}
					appearance={{ change: vi.fn(), closed: false, density: "comfortable", notice: "", theme: "system" }}
					close={close}
					open
					toggleSidebar={vi.fn()}
				/>
			);
		}),
	);

	const field = view.container.querySelector("input");
	if (!field) {
		throw new Error("Missing search field");
	}
	act(() => {
		field.value = "Shared phrase";
		field.dispatchEvent(new Event("input", { bubbles: true }));
	});
	yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll('#search-results [role="option"]')).toHaveLength(3)));
	act(() => {
		field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
		field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
	});
	expect(field.getAttribute("aria-activedescendant")).toBe("search-result-2");
	expect(view.container.querySelector('#search-results [aria-selected="true"]')?.id).toBe("search-result-2");
	files["notes/second.md"] = "# Second\n\nNo match.\n";
	files["notes/third.md"] = "# Third\n\nNo match.\n";
	yield* Effect.promise(() => act(async () => refresh?.()));
	yield* Effect.promise(() => eventually(() => expect(view.container.querySelectorAll('#search-results [role="option"]')).toHaveLength(1)));
	expect(field.getAttribute("aria-activedescendant")).toBe("search-result-0");
	const remaining = view.container.querySelector('#search-results [aria-selected="true"]');
	expect(remaining?.getAttribute("href")).toBe("/notes/first.md#heading-first");
	const opened = vi.fn((event: Event) => event.preventDefault());
	remaining?.addEventListener("click", opened);
	const enter = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" });
	act(() => field.dispatchEvent(enter));
	expect(enter.defaultPrevented).toBe(true);
	expect(opened).toHaveBeenCalledOnce();
	expect(close).toHaveBeenCalled();
	expect(view.container.querySelector("dialog")?.returnValue).toBe("navigate");
	expect(view.container.querySelector("dialog")?.open).toBe(false);
});

for (const { initial, previous } of [
	{ initial: "", previous: "/" },
	{ initial: "First phrase", previous: "/notes/first.md#heading-first" },
]) {
	screenStory.it(`does not activate '${initial}' options when Enter follows a query edit before debounce`, [], function* ({ renderBoard, keyboard }) {
		const close = vi.fn();
		const view = yield* Effect.promise(() =>
			renderBoard(
				{
					"notes/first.md": "# First\n\nFirst phrase.\n",
					"notes/second.md": "# Second\n\nSecond phrase.\n",
				},
				(api) => (
					<SearchDialog
						api={api}
						appearance={{ change: vi.fn(), closed: false, density: "comfortable", notice: "", theme: "system" }}
						close={close}
						open
						toggleSidebar={vi.fn()}
					/>
				),
			),
		);

		const field = view.container.querySelector("input");
		const results = view.container.querySelector("#search-results");
		if (!(field && results)) {
			throw new Error("Missing search controls");
		}
		if (initial) {
			act(() => {
				field.value = initial;
				field.dispatchEvent(new Event("input", { bubbles: true }));
			});
		}
		yield* Effect.promise(() => eventually(() => expect(results.querySelector('[aria-selected="true"]')?.getAttribute("href")).toBe(previous)));
		const opened = vi.fn((event: Event) => event.preventDefault());
		results.addEventListener("click", opened);
		act(() => {
			field.value = "Second phrase";
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
		const enter = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" });
		act(() => field.dispatchEvent(enter));
		expect(opened).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
		expect(view.container.querySelector("dialog")?.open).toBe(true);
		expect(field.getAttribute("aria-activedescendant")).toBeNull();
		expect(results.querySelectorAll('[role="option"]')).toHaveLength(0);
		expect(enter.defaultPrevented).toBe(false);
		act(() => field.form?.requestSubmit());
		yield* Effect.promise(() =>
			eventually(() => expect(results.querySelector('[aria-selected="true"]')?.getAttribute("href")).toBe("/notes/second.md#heading-second")),
		);
		expect(results.querySelectorAll('[role="option"]')).toHaveLength(1);
		keyboard("Enter", { bubbles: true, cancelable: true }, field);
		expect(opened).toHaveBeenCalledOnce();
		expect(close).toHaveBeenCalled();
		expect(view.container.querySelector("dialog")?.returnValue).toBe("navigate");
	});
}
