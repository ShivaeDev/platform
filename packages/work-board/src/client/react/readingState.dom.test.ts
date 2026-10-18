import { afterEach, expect, it } from "vitest";
import { captureReading, restoreReading } from "./readingState.ts";

afterEach(() => document.body.replaceChildren());
it.each(["response", "handoff"])("keeps document reading selection separate from the %s form's caret", (kind) => {
	document.body.innerHTML = `<aside id="sidebar"></aside><main id="doc"><p>Reviewed context</p><form id="${kind}-form"><textarea name="body">Direction in progress</textarea></form></main>`;
	const control = document.querySelector("textarea");
	const passage = document.querySelector("p")?.firstChild;
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
	expect(document.activeElement).toBe(control);
	expect([control.selectionStart, control.selectionEnd, control.selectionDirection]).toEqual([4, 9, "backward"]);
});
