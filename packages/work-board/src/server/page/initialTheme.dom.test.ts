import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { savedAppearance } from "#test/savedAppearance.ts";

for (const [saved, system, expected] of [
	['{"theme":"dark"}', "light", "dark"],
	['{"theme":"light"}', "dark", "light"],
	['{"theme":"system"}', "dark", "dark"],
	["{}", "light", "light"],
	['{"theme":"other"}', "dark", "dark"],
	["null", "dark", "dark"],
	["invalid", "dark", "dark"],
	[undefined, "dark", "dark"],
] as const) {
	boardStory.it(
		`initializes saved ${saved} with system ${system} from the served shell and paints its skeleton in that scheme`,
		[projectFiles({ "plan.md": "# Plan" }), savedAppearance(saved, system), readerAt("/plan.md")],
		({ page }) => {
			expect(page.pageRequests.beforeReact).toEqual({
				dark: expected === "dark",
				scheme: expected,
				sidebar: "open",
				skeleton: true,
			});
			expect(page.document.querySelector("[data-board-skeleton]")).toBeNull();
			expect(page.document.documentElement.dataset.scheme).toBe(expected);
			expect(page.document.documentElement.classList.contains("dark")).toBe(expected === "dark");
		},
	);
}

for (const [saved, sidebar] of [
	['{"closed":true}', "closed"],
	['{"closed":false}', "open"],
	['{"closed":"yes"}', "open"],
] as const) {
	boardStory.it(
		`outlines the ${sidebar} sidebar before React when the reader saved ${saved}`,
		[projectFiles({ "plan.md": "# Plan" }), savedAppearance(saved, "light"), readerAt("/plan.md")],
		({ page }) => {
			expect(page.pageRequests.beforeReact).toEqual({ dark: false, scheme: "light", sidebar, skeleton: true });
		},
	);
}
