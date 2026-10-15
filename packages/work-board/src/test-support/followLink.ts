import type { OpenPage } from "./browser.ts";
export function followLink(page: OpenPage, href: string) {
	const link = page.document.createElement("a");
	link.href = href;
	page.document.getElementById("doc")?.append(link);
	link.dispatchEvent(new page.window.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
	link.remove();
}
