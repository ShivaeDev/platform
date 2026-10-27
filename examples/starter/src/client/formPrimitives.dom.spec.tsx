import { expect } from "vitest";
import { formPrimitives } from "#test-support/formPrimitives.tsx";
import { screens } from "#test-support/screens.ts";

screens.it(
	"an app renders the stock textarea and select in a form",
	[formPrimitives],
	function* ({ accessible, enterControl, clickControl, findControl, submitControl, controlText }) {
		expect(accessible('[data-slot="textarea"]')).toEqual({ name: "Summary", role: "textbox" });
		expect(accessible('[data-slot="select-trigger"]')).toEqual({ name: "Status", role: "combobox" });
		yield* enterControl({ name: "Summary", role: "textbox" }, "Ready for review");
		yield* clickControl({ name: "Status", role: "combobox" });
		yield* findControl({ name: "Published", role: "option" });
		yield* clickControl({ name: "Published", role: "option" });
		yield* submitControl();
		expect(controlText("output")).toBe("Ready for review (published)");
	},
);

screens.it("an app renders the stock dialog through its portal", [formPrimitives], function* ({ clickControl, findControl, accessible }) {
	yield* clickControl({ name: "Details", role: "button" });
	const dialog = yield* findControl({ name: "Form details", role: "dialog" });
	expect(accessible(dialog)).toEqual({ name: "Form details", role: "dialog" });
	expect(dialog.textContent).toContain("Choose a status and write a summary.");
	yield* clickControl({ name: "Close", role: "button" });
	expect(document.querySelector('[role="dialog"]')).toBeNull();
});
