import { act } from "react";
import { expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { fleetRankingFixture } from "#test/searchRankingFixture.ts";
import { SearchDialog } from "./SearchDialog.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("puts open body matches and done items before headings, includes Fleet status and reports only with records:, and keeps anchors unique", async () => {
	const { files, modified } = fleetRankingFixture();
	const view = await renderBoard(
		files,
		(api) => (
			<SearchDialog
				api={api}
				appearance={{ change: vi.fn(), closed: false, density: "comfortable", notice: "", theme: "light" }}
				close={vi.fn()}
				open
				toggleSidebar={vi.fn()}
			/>
		),
		{ home: undefined, modified },
	);
	function rows() {
		return [...view.container.querySelectorAll<HTMLAnchorElement>('[role="option"]')];
	}
	function type(query: string) {
		const field = view.container.querySelector("input");
		if (!field) {
			throw new Error("Missing palette input");
		}
		act(() => {
			field.value = query;
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	try {
		for (const query of ["watch", "records: watch"]) {
			type(query);
			await eventually(() => expect(rows()[0]?.getAttribute("href")).toBe("/_board/item/task.review/"));
			expect(
				rows()
					.slice(0, 2)
					.map((row) => row.querySelector("strong")?.textContent),
			).toEqual(["Keep reviews visible", "Done watch"]);
			expect(
				rows()
					.slice(0, 2)
					.map((row) => row.querySelector("[data-status-token]")?.textContent),
			).toEqual(["active", "done"]);
			expect(rows()[0]?.querySelector("p")?.textContent).toBe("The watch keeps running.");
			expect(rows().some((row) => row.querySelector("strong")?.textContent === "Watch notes")).toBe(true);
			const hrefs = rows().map((row) => row.getAttribute("href"));
			expect(new Set(hrefs).size).toBe(hrefs.length);
			const recordRows = rows().filter((row) => /(?:fleet\/status|responses\/fleet-report)/u.test(row.href));
			if (query.startsWith("records:")) {
				expect(recordRows.length).toBeGreaterThan(0);
				expect(hrefs.findIndex((href) => href?.startsWith("/responses/fleet-report."))).toBeGreaterThan(1);
				expect(hrefs.findIndex((href) => href?.startsWith("/fleet/status.md"))).toBeGreaterThan(1);
			} else {
				expect(recordRows).toEqual([]);
			}
			expect(view.container.textContent).not.toContain("Not recorded");
			for (const row of rows()) {
				expect(row.querySelector("p")?.textContent ?? "").not.toMatch(/^(?:\{|---)|(?:id|kind|status):/u);
			}
		}
	} finally {
		await view.unmount();
	}
});
