import { expect } from "vitest";
import type { OpenPage } from "./browser.ts";

export function expectTitleInFirstScreen(page: OpenPage): void {
	const { document, window } = page;
	function element(selector: string) {
		const found = document.querySelector(selector);
		if (!(found instanceof window.HTMLElement)) {
			throw new Error(`Missing ${selector}`);
		}
		return found;
	}
	function pixels(value: string) {
		if (value === "") {
			return 0;
		}
		expect(value).toMatch(/^\d+(?:\.\d+)?px$/u);
		return Number.parseFloat(value);
	}
	const main = element("#doc");
	const layout = element(".document-layout");
	const introduction = element(".item-introduction");
	const title = element(".item-introduction h1");
	expect([...element("[data-board-page]").children]).toEqual([element("header"), main]);
	expect(main.firstElementChild).toBe(layout);
	expect(layout.firstElementChild).toBe(introduction);
	expect(introduction.firstElementChild).toBe(title);
	expect(window.getComputedStyle(layout).display).toBe("grid");
	expect(window.getComputedStyle(introduction).gridRow).toBe(window.innerWidth >= 1100 ? "1" : "");
	if (window.innerWidth < 768) {
		expect(element("#sidebar").hidden).toBe(true);
	}
	const header = element("header");
	expect(header.classList.contains("h-14")).toBe(true);
	expect(header.classList.contains("flex")).toBe(true);
	expect(header.classList.contains("flex-wrap")).toBe(false);
	let maximumTitleTop = 56;

	for (const selector of [
		"body",
		"[data-board-workspace]",
		"[data-board-page]",
		"#doc",
		".document-layout",
		".item-introduction",
		".item-introduction h1",
	]) {
		const style = window.getComputedStyle(element(selector));
		expect(["", "static"]).toContain(style.position);
		expect(["", "none"]).toContain(style.transform);
		expect(["", "normal", "start"]).toContain(style.alignContent);
		maximumTitleTop += pixels(style.marginTop) + pixels(style.paddingTop) + pixels(style.borderTopWidth);
	}
	// The fixture has no layout engine; this is a CSS upper bound, not a measured rectangle.
	expect(maximumTitleTop).toBeLessThan(window.innerHeight);
}
