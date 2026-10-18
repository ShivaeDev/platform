import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { readingScreen } from "#test/screenTraits.ts";

for (const kind of ["response", "handoff"]) {
	screenStory.it(
		"retains the form caret while restoring document reading",
		[readingScreen(kind)],
		({ captureReading, restoreReading, findElement, readFocus }) => {
			const control = findElement("textarea");
			const passage = findElement("p")?.firstChild;
			if (!(control && passage)) {
				throw new Error("Missing reading fixture");
			}

			document.getSelection()?.setBaseAndExtent(passage, 0, passage, 8);
			const documentState = captureReading();
			expect(documentState?.selection).not.toBeNull();
			control.focus();
			control.setSelectionRange(4, 9, "backward");
			expect(captureReading()?.selection).toBeNull();
			if (documentState) {
				restoreReading(documentState);
			}
			expect(readFocus()).toBe(control);
			expect([control.selectionStart, control.selectionEnd, control.selectionDirection]).toEqual([4, 9, "backward"]);
		},
	);
}
