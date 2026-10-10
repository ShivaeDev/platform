import type { OpenPage } from "#test/browser.ts";

export function enterField(page: OpenPage, name: string, value: string) {
	const field = page.document.querySelector(`[name="${name}"]`);
	if (!(field instanceof page.window.HTMLInputElement || field instanceof page.window.HTMLTextAreaElement)) {
		throw new Error(`Missing form field ${name}`);
	}
	field.value = value;
	field.dispatchEvent(new page.window.Event("input", { bubbles: true }));
	return field;
}
