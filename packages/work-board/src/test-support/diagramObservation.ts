import type { OpenPage } from "./browser.ts";

export function figure(page: OpenPage) {
	return page.document.querySelector("figure.diagram");
}

export function sourceDisplay(page: OpenPage) {
	return figure(page)?.querySelector(".diagram-source")?.hasAttribute("hidden") ? "none" : "block";
}
