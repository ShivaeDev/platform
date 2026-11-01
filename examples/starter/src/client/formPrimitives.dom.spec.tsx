import { expect } from "vitest";
import { formPrimitives } from "#test-support/formPrimitives.tsx";
import { screens } from "#test-support/screens.ts";

screens.it(
	"the stock form submits the textarea's summary and the select's chosen status",
	[formPrimitives],
	function* ({ clickControl, controlText, enterControl, findControl, submitControl }) {
		yield* enterControl({ name: "Summary", role: "textbox" }, "Ready for review");
		yield* clickControl({ name: "Status", role: "combobox" });
		yield* findControl({ name: "Published", role: "option" });
		yield* clickControl({ name: "Published", role: "option" });

		yield* submitControl();

		expect(controlText("output")).toBe("Ready for review (published)");
	},
);

screens.it(
	"the stock dialog opens through its portal and its Close button closes it",
	[formPrimitives],
	function* ({ clickControl, findControl, shown }) {
		yield* clickControl({ name: "Details", role: "button" });
		const dialog = yield* findControl({ name: "Form details", role: "dialog" });
		expect(dialog.textContent).toContain("Choose a status and write a summary.");

		yield* clickControl({ name: "Close", role: "button" });

		expect(yield* shown('[role="dialog"]')).toBe("hidden");
	},
);
