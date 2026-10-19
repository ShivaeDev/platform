import { vi } from "vitest";
import { headings, SPACING, StoryObserver } from "./outlineActions.ts";
import { screenStory } from "./screenStory.ts";

// jsdom lays nothing out and has no IntersectionObserver, so the story places every heading a fixed distance apart and reports crossings itself.
export function observedOutline() {
	return screenStory.trait("workspace", `the browser lays headings ${SPACING} pixels apart and reports them crossing the viewport`, (engine) => {
		const outline = { offset: 0 };
		engine.outline = outline;
		StoryObserver.observed.clear();
		vi.stubGlobal("IntersectionObserver", StoryObserver);
		const measure = Element.prototype.getBoundingClientRect;
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const index = headings().indexOf(this);
			return index < 0 ? measure.call(this) : new DOMRect(0, index * SPACING - outline.offset, 600, 40);
		});
		vi.spyOn(window, "scrollY", "get").mockImplementation(() => outline.offset);
		vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => headings().length * SPACING);
	});
}
