import { expect } from "vitest";
import { InvoiceLine } from "#test/invoice-line-editor/backend.ts";
import { stapler } from "#test/invoiceScreens.tsx";
import { creatingLine, editingLine, invoiceSessions, invoices } from "#test/invoiceStories.ts";

invoices.it(
	"Retry keeps the dirty editor mounted",
	[editingLine()],
	function* ({ invoice, type, click, observe, finishLoad, serverUnavailable, serverAvailable }) {
		const { view } = invoice();
		expect(view.text()).toContain("Loading");
		expect(view.value("name")).toBeUndefined();
		yield* finishLoad();
		yield* observe("the invoice loads", () => expect(view.value("name")).toBe("Stapler"));
		const input = view.container.querySelector('input[name="name"]');
		const form = view.container.querySelector("form");
		yield* type("name", "Blue stapler");
		serverUnavailable();
		yield* click("Refresh");
		yield* observe("the invoice screen settles", () => expect(view.alerts()).toContain("Could not load"));
		expect(view.text()).toContain("Stapler / 150");
		expect(view.value("name")).toBe("Blue stapler");
		expect(view.container.querySelector("form")).toBe(form);
		expect(view.container.querySelector('input[name="name"]')).toBe(input);
		serverAvailable();
		yield* click("Retry");
		yield* observe("the invoice screen settles", () => expect(view.alerts()).toEqual([]));
		expect(view.value("name")).toBe("Blue stapler");
		expect(view.status()).toBe("Unsaved");
		expect(view.container.querySelector("form")).toBe(form);
		expect(view.container.querySelector('input[name="name"]')).toBe(input);
	},
);

invoices.it(
	"a refresh while dirty adopts untouched fields and keeps edited ones",
	[editingLine()],
	function* ({ invoice, type, click, observe, finishLoad, serverEdit }) {
		const { view } = invoice();
		yield* finishLoad();
		yield* observe("the invoice loads", () => expect(view.value("name")).toBe("Stapler"));
		yield* type("name", "Black stapler");
		serverEdit(new InvoiceLine({ id: 1, name: "Stapler", quantity: 175 }));
		yield* click("Refresh");
		yield* observe("the invoice screen settles", () => expect(view.value("quantity")).toBe("175"));
		expect(view.value("name")).toBe("Black stapler");
	},
);

invoices.it(
	"save shows server normalization, keeps edits made while saving and ignores a second submit",
	[editingLine()],
	function* ({ invoice, type, click, observe, holdSave, finishSave, finishLoad }) {
		const { server, view } = invoice();
		yield* finishLoad();
		yield* observe("the invoice loads", () => expect(view.value("name")).toBe("Stapler"));
		yield* type("name", "  blue stapler ");
		holdSave();
		yield* click("Save");
		yield* observe("the invoice screen settles", () => expect(view.status()).toBe("Saving"));
		yield* type("quantity", "160");
		yield* click("Save");
		yield* finishSave();
		yield* observe("the invoice screen settles", () => expect(view.value("name")).toBe("Blue stapler"));
		expect(view.value("quantity")).toBe("160");
		expect(view.status()).toBe("Unsaved");
		expect(server.control.saves).toBe(1);
		expect(server.stored(1)).toEqual(new InvoiceLine({ id: 1, name: "Blue stapler", quantity: 150, version: 2 }));
	},
);

invoices.it(
	"field rejections attach to their field; other failures are exposed separately",
	[editingLine()],
	function* ({ invoice, type, click, observe, finishLoad, serverUnavailable }) {
		const { server, view } = invoice();
		yield* finishLoad();
		yield* observe("the invoice loads", () => expect(view.value("name")).toBe("Stapler"));
		yield* type("quantity", "9000");
		yield* click("Save");
		yield* observe("the invoice screen settles", () => expect(view.error("quantity")).toBe("Quantity is too large"));
		expect(view.alerts()).toEqual([]);
		yield* type("quantity", "200");
		expect(view.error("quantity")).toBeUndefined();
		serverUnavailable();
		yield* click("Save");
		yield* observe("the invoice screen settles", () => expect(view.alerts()).toEqual(["Could not save"]));
		expect(view.value("quantity")).toBe("200");
		expect(server.stored(1)).toEqual(stapler);
	},
);

invoices.it(
	"a different key remounts the form without carrying the previous draft",
	[editingLine()],
	function* ({ invoice, type, show, observe, finishLoad }) {
		const { view } = invoice();
		yield* finishLoad();
		yield* observe("the invoice loads", () => expect(view.value("name")).toBe("Stapler"));
		yield* type("name", "Draft");
		yield* show(2);
		yield* observe("the invoice screen settles", () => expect(view.value("name")).toBe("Notebook"));
		expect(view.status()).toBe("Saved");
		yield* show(1);
		yield* observe("the invoice screen settles", () => expect(view.value("name")).toBe("Stapler"));
	},
);

invoices.it(
	"create resets to its initial values after success, keeping fields edited during the save",
	[creatingLine()],
	function* ({ invoice, type, click, observe, holdSave, finishSave }) {
		const { view } = invoice();
		yield* type("name", "pencil");
		yield* type("quantity", "120");
		holdSave();
		yield* click("Save");
		yield* observe("the invoice screen settles", () => expect(view.status()).toBe("Saving"));
		yield* type("name", "Folder");
		yield* finishSave();
		yield* observe("the invoice screen settles", () => expect(view.text()).toContain("Created 2: Pencil"));
		expect(view.value("name")).toBe("Folder");
		expect(view.value("quantity")).toBe("");
		expect(view.error("quantity")).toBeUndefined();
		expect(view.status()).toBe("Unsaved");
		yield* type("quantity", "40");
		yield* click("Save");
		yield* observe("the invoice screen settles", () => expect(view.text()).toContain("Created 3: Folder"));
		expect([view.value("name"), view.value("quantity"), view.status()]).toEqual(["", "", "Saved"]);
	},
);

invoices.it(
	"switching session tears down the editor, its draft and its registry; Unauthorized asks for a re-check",
	[invoiceSessions()],
	function* ({ sessions, type, click, showSession, observe, rejectSession }) {
		const { view, rechecks, registries } = sessions();
		yield* showSession("alice");
		yield* observe("the invoice screen settles", () => expect(view.value("name")).toBe("Stapler"));
		yield* type("name", "Alice draft");
		rejectSession("alice");
		yield* click("Refresh");
		yield* observe("the invoice screen settles", () => expect(rechecks).toEqual(["alice"]));
		expect(view.value("name")).toBe("Alice draft");
		yield* showSession("bob");
		yield* observe("the invoice screen settles", () => expect(view.value("name")).toBe("Envelope"));
		expect(view.text()).not.toContain("Stapler");
		expect(registries[0]?.getNodes().size).toBe(0);
		yield* showSession(undefined);
		expect(view.text()).toBe("Signed out");
		expect(registries[1]?.getNodes().size).toBe(0);
	},
);
