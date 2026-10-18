import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { readingScreen } from "#test/screenTraits.ts";

for (const kind of ["response", "handoff"]) {
	screenStory.it(
		"retains the form caret while restoring document reading",
		[readingScreen(kind)],
		({ captureReading, restoreReading, findElement, readFocus, selectPassage, selectText, readTextSelection }) => {
			const control = findElement("textarea");
			selectPassage("p", 0, 8);
			const documentState = captureReading();
			expect(documentState?.selection).toMatchObject({ a: 0, f: 8 });
			selectText("textarea", 4, 9, "backward");
			expect(captureReading()?.selection).toBeNull();
			if (documentState) {
				restoreReading(documentState);
			}
			expect(readFocus()).toBe(control);
			expect(readTextSelection("textarea")).toEqual([4, 9, "backward"]);
		},
	);
}
