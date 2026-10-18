import { act } from "react";
import { expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { fleetItemRankingFixture } from "#test/searchRankingFixture.ts";
import { SearchDialog } from "./SearchDialog.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("puts open body matches and done items before headings, includes Fleet status and reports only with records:, and keeps anchors unique", async () => {
	const { files, modified } = fleetItemRankingFixture();
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
			const records = query.startsWith("records:");
			await eventually(() => expect(rows()[0]?.querySelector("code")?.textContent).toBe(records ? "decision.watch" : "task.review"));
			const work = rows().filter((row) => row.querySelector("code")?.textContent?.startsWith("task."));
			expect(work.slice(0, 2).map((row) => row.querySelector("strong")?.textContent)).toEqual(["Keep reviews visible", "Done watch"]);
			expect(work.slice(0, 2).map((row) => row.querySelector("[data-status-token]")?.textContent)).toEqual(["active", "done"]);
			expect(work[0]?.querySelector("p")?.textContent).toBe("The watch keeps running.");
			expect(rows().some((row) => row.querySelector("strong")?.textContent === "Watch notes")).toBe(true);
			const hrefs = rows().map((row) => row.getAttribute("href"));
			expect(new Set(hrefs).size).toBe(hrefs.length);
			const recordRows = rows().filter((row) => /(?:fleet\/status|responses\/fleet-report)/u.test(row.href));
			if (query.startsWith("records:")) {
				expect(
					rows()
						.slice(0, 4)
						.map((row) => row.querySelector("strong")?.textContent),
				).toEqual(["Watch decision", "Review policy", "Keep reviews visible", "Done watch"]);
				expect(rows()[1]?.querySelector("p")?.textContent).toBe("The watch needs a policy.");
				expect(recordRows.length).toBeGreaterThan(0);
				expect(hrefs.findIndex((href) => href?.startsWith("/responses/fleet-report."))).toBeGreaterThan(1);
				expect(hrefs.findIndex((href) => href?.startsWith("/fleet/status.md"))).toBeGreaterThan(1);
			} else {
				expect(recordRows).toEqual([]);
				expect(rows().some((row) => row.querySelector("code")?.textContent?.startsWith("decision."))).toBe(false);
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
