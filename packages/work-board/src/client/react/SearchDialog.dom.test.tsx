import { act } from "react";
import { expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { SearchDialog } from "./SearchDialog.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
it("selects and opens the remaining result when a query refresh removes the selected third result", async () => {
	const files = {
		"notes/first.md": "# First\n\nShared phrase one.\n",
		"notes/second.md": "# Second\n\nShared phrase two.\n",
		"notes/third.md": "# Third\n\nShared phrase three.\n",
	};
	const close = vi.fn();
	let refresh: (() => void) | undefined;
	const view = await renderBoard(files, (api, registry) => {
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
	});
	try {
		const field = view.container.querySelector("input");
		if (!field) {
			throw new Error("Missing search field");
		}
		act(() => {
			field.value = "Shared phrase";
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await eventually(() => expect(view.container.querySelectorAll('#search-results [role="option"]')).toHaveLength(3));
		act(() => {
			field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
			field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
		});
		expect(field.getAttribute("aria-activedescendant")).toBe("search-result-2");
		expect(view.container.querySelector('#search-results [aria-selected="true"]')?.id).toBe("search-result-2");
		files["notes/second.md"] = "# Second\n\nNo match.\n";
		files["notes/third.md"] = "# Third\n\nNo match.\n";
		await act(async () => refresh?.());
		await eventually(() => expect(view.container.querySelectorAll('#search-results [role="option"]')).toHaveLength(1));
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
	} finally {
		await view.unmount();
	}
});
