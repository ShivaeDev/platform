import { expect } from "vitest";
import { InvoiceLine } from "#test/invoice-line-editor/backend.ts";
import { invoices, oneShotLine } from "#test/invoiceStories.ts";

invoices.it("One-shot edit submits its opening version", [oneShotLine()], function* ({ invoice, type, click, observe }) {
	const { server, view } = invoice();
	expect(view.value("name")).toBe("Stapler");
	yield* type("name", "  blue stapler ");
	yield* click("Save");
	yield* observe("the app receives the normalized saved row", () => expect(view.text()).toContain("Completed 7: Blue stapler / 150 (version 4)"));
	expect(server.control.gets).toBe(0);
	expect(server.stored(7)).toEqual(new InvoiceLine({ id: 7, name: "Blue stapler", quantity: 150, version: 4 }));
});

invoices.it("Held one-shot save preserves newer input", [oneShotLine()], function* ({ invoice, type, click, observe, holdSave, finishSave }) {
	const { view } = invoice();
	yield* type("name", "Blue stapler");
	holdSave();
	yield* click("Save");
	yield* observe("the submission is pending", () => expect(view.status()).toBe("Saving"));
	yield* type("name", "Red stapler");
	yield* finishSave();
	yield* observe("the app completes the submitted update", () => expect(view.text()).toContain("Completed 7: Blue stapler / 150 (version 4)"));
	expect(view.value("name")).toBe("Red stapler");
	expect(view.status()).toBe("Unsaved");
});

invoices.it(
	"a stale expected version shows conflict feedback without losing input",
	[oneShotLine()],
	function* ({ invoice, type, click, observe, serverEdit }) {
		const { server, view } = invoice();
		yield* type("name", "My stapler");
		serverEdit(new InvoiceLine({ id: 7, name: "Their stapler", quantity: 200, version: 4 }));
		yield* click("Save");
		yield* observe("the app explains the conflict", () => expect(view.alerts()).toContain("This line changed. Reopen it to use the latest version."));
		expect(view.value("name")).toBe("My stapler");
		expect(view.value("quantity")).toBe("150");
		expect(view.status()).toBe("Unsaved");
		expect(view.text()).not.toContain("Completed");
		expect(server.stored(7)).toEqual(new InvoiceLine({ id: 7, name: "Their stapler", quantity: 200, version: 4 }));
		expect(server.control.gets).toBe(0);
	},
);
