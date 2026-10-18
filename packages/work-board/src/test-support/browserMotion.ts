import { vi } from "vitest";
import { control } from "./chrome.ts";
import { screenStory } from "./screenStory.ts";

export function observedBrowserMotion() {
	return screenStory.trait("workspace", "the browser records scroll and focus requests", (engine) => {
		engine.motion = {
			focus: vi.spyOn(HTMLElement.prototype, "focus"),
			passage: vi.spyOn(HTMLElement.prototype, "scrollIntoView"),
			scroll: vi.spyOn(window, "scrollTo"),
		};
		engine.scrollPosition = 0;
		vi.spyOn(window, "scrollY", "get").mockImplementation(() => engine.scrollPosition ?? 0);
	});
}

export function selectionResetOnFocus() {
	return screenStory.trait("screen", "the browser resets the text caret during focus", () => {
		const textarea = control("#response-form textarea", HTMLTextAreaElement);
		const focus = textarea.focus.bind(textarea);
		vi.spyOn(textarea, "focus").mockImplementation((options) => {
			focus(options);
			textarea.setSelectionRange(0, 0);
		});
	});
}
