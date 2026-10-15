import { act } from "react";
import { expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { searchRankingFixture } from "#test/searchRankingFixture.ts";
import { SearchDialog } from "./SearchDialog.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("shows open watch work before newer done matches in the palette", async () => {
	const { files, modified } = searchRankingFixture();
	const view = await renderBoard(
		files,
		(api) => (
			<SearchDialog
				api={api}
				appearance={{ change: vi.fn(), closed: false, density: "comfortable", notice: "", theme: "light" }}
				close={vi.fn()}
				open
				openLibrary={vi.fn()}
				toggleSidebar={vi.fn()}
			/>
		),
		{ home: undefined, modified },
	);
	try {
		const field = view.container.querySelector("input");
		if (!field) {
			throw new Error("Missing palette input");
		}
		act(() => {
			field.value = "watch";
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await eventually(() => expect(view.container.querySelector('[role="option"] strong')?.textContent).toBe("A running watch sees reviews finish"));
		const rows = [...view.container.querySelectorAll('[role="option"]')];
		const statuses = rows.map((row) => row.querySelector("[data-status-token]")?.textContent);
		const firstClosed = statuses.indexOf("done");
		expect(firstClosed).toBeGreaterThan(0);
		expect(statuses[0]).toBe("planned");
		expect(statuses.slice(0, firstClosed).every((status) => ["planned", "needs-you", "active", "fleet-held"].includes(status ?? ""))).toBe(true);
		expect(statuses.slice(firstClosed).every((status) => ["done", "deferred", "superseded"].includes(status ?? ""))).toBe(true);
	} finally {
		await view.unmount();
	}
});
