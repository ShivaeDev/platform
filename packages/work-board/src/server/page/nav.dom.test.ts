import { expect, it } from "vitest";
import { navHtml } from "./nav.ts";

it("keeps fallback navigation bounded for 1,500 documents", () => {
	const nav = document.createElement("nav");
	nav.innerHTML = navHtml(
		Array.from({ length: 1500 }, (_, index) => ({ modified: index, path: `notes/${index}.md` })),
		"",
		undefined,
	);
	expect(nav.querySelectorAll("a")).toHaveLength(5);
	expect(nav.querySelector("#work-open")?.getAttribute("href")).toBe("/_board/work");
	expect(nav.textContent).toContain("Library (1500)");
});
