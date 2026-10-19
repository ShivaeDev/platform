import type { OpenPage } from "./browser.ts";

export function frame(page: OpenPage) {
	return new Promise<void>((resolve) => page.window.requestAnimationFrame(() => resolve()));
}

export function title(page: OpenPage) {
	return page.document.querySelector("#doc h1")?.textContent;
}

export function element(page: OpenPage, id: string) {
	const found = page.document.getElementById(id);
	if (!(found instanceof page.window.HTMLElement)) {
		throw new Error(`Missing ${id}`);
	}
	return found;
}

export function roleOf(control: Element) {
	return control.getAttribute("role") ?? (control.tagName === "A" && control.hasAttribute("href") ? "link" : control.tagName.toLowerCase());
}
