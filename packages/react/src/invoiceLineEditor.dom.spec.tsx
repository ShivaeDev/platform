import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { InvoiceLine } from "#test/invoice-line-editor/backend.ts";
import { stapler } from "#test/invoiceScreens.tsx";
import {
	aliceEditing,
	bobAfterAlice,
	createdWhileFolderTyped,
	createSaveHeld,
	draftDroppedForLineTwo,
	editorSaveHeld,
	invoices,
	lineEdited,
	quantityRejected,
	refreshFailedWithDraft,
} from "#test/invoiceStories.ts";

invoices.it(
	"a failed refresh keeps the dirty editor mounted with its draft",
	[lineEdited("name", "Blue stapler")],
	function* ({ alerts, field, form, refresh, serverIs, shownLine }) {
		yield* serverIs("unavailable");

		yield* refresh();

		yield* outcomes({
			alerts: [alerts(), ["Could not load"]],
			draft: [field("name"), "Blue stapler"],
			form: [form(), "same form and inputs"],
			"shown line": [shownLine(), "Stapler / 150"],
		});
	},
);

invoices.it(
	"Retry after a failed refresh keeps the draft unsaved in the same form",
	[refreshFailedWithDraft()],
	function* ({ alerts, field, form, retry, serverIs, status }) {
		yield* serverIs("available");

		yield* retry();

		yield* outcomes({
			alerts: [alerts(), []],
			draft: [field("name"), "Blue stapler"],
			form: [form(), "same form and inputs"],
			status: [status(), "Unsaved"],
		});
	},
);

invoices.it(
	"a refresh while dirty adopts the server's untouched field and keeps the edited one",
	[lineEdited("name", "Black stapler")],
	function* ({ field, refresh, serverEdits }) {
		yield* serverEdits(new InvoiceLine({ id: 1, name: "Stapler", quantity: 175 }));

		yield* refresh();

		yield* outcomes({
			name: [field("name"), "Black stapler"],
			quantity: [field("quantity"), "175"],
		});
	},
);

invoices.it(
	"a save shows and stores the server's normalized row",
	[lineEdited("name", "  blue stapler ")],
	function* ({ field, save, status, storedLine }) {
		yield* save();

		yield* outcomes({
			name: [field("name"), "Blue stapler"],
			status: [status(), "Saved"],
			stored: [storedLine(1), { ...new InvoiceLine({ id: 1, name: "Blue stapler", quantity: 150, version: 2 }) }],
		});
	},
);

invoices.it("input typed while a save waits survives the saved row", [editorSaveHeld()], function* ({ field, finishHeld, status, type }) {
	yield* type("quantity", "160");

	yield* finishHeld();

	yield* outcomes({
		name: [field("name"), "Blue stapler"],
		quantity: [field("quantity"), "160"],
		status: [status(), "Unsaved"],
	});
});

invoices.it("a second Save while one waits sends nothing more", [editorSaveHeld()], function* ({ finishHeld, save, savedDrafts }) {
	yield* save();
	yield* finishHeld();

	expect(yield* savedDrafts()).toEqual([{ expectedVersion: 1, id: 1, name: "  blue stapler ", quantity: 150 }]);
});

invoices.it("a field rejection attaches to its field without an alert", [lineEdited("quantity", "9000")], function* ({ alerts, fieldError, save }) {
	yield* save();

	yield* outcomes({
		alerts: [alerts(), []],
		"quantity error": [fieldError("quantity"), "Quantity is too large"],
	});
});

invoices.it("typing in a rejected field clears its error", [quantityRejected()], function* ({ fieldError, type }) {
	yield* type("quantity", "200");

	expect(yield* fieldError("quantity")).toBe("none");
});

invoices.it(
	"a failed save shows an alert and keeps the input",
	[lineEdited("quantity", "200")],
	function* ({ alerts, field, save, serverIs, storedLine }) {
		yield* serverIs("unavailable");

		yield* save();

		yield* outcomes({
			alerts: [alerts(), ["Could not save"]],
			quantity: [field("quantity"), "200"],
			stored: [storedLine(1), { ...stapler }],
		});
	},
);

invoices.it("a different line remounts the form without the previous draft", [lineEdited("name", "Draft")], function* ({ field, show, status }) {
	yield* show(2);

	yield* outcomes({
		name: [field("name"), "Notebook"],
		status: [status(), "Saved"],
	});
});

invoices.it("returning to a line after leaving it shows its stored name", [draftDroppedForLineTwo()], function* ({ field, show }) {
	yield* show(1);

	expect(yield* field("name")).toBe("Stapler");
});

invoices.it(
	"a create resets to its initial values and keeps fields edited during the save",
	[createSaveHeld()],
	function* ({ completed, field, fieldError, finishHeld, status, type }) {
		yield* type("name", "Folder");

		yield* finishHeld();

		yield* outcomes({
			created: [completed(), "Created 2: Pencil"],
			name: [field("name"), "Folder"],
			quantity: [field("quantity"), ""],
			"quantity error": [fieldError("quantity"), "none"],
			status: [status(), "Unsaved"],
		});
	},
);

invoices.it(
	"the next create submits the field kept through the reset",
	[createdWhileFolderTyped()],
	function* ({ completed, field, save, status, type }) {
		yield* type("quantity", "40");

		yield* save();

		yield* outcomes({
			created: [completed(), "Created 3: Folder"],
			name: [field("name"), ""],
			quantity: [field("quantity"), ""],
			status: [status(), "Saved"],
		});
	},
);

invoices.it(
	"an Unauthorized refresh asks for a session re-check and keeps the draft",
	[aliceEditing()],
	function* ({ field, rechecks, refresh, unauthorized }) {
		yield* unauthorized("alice");

		yield* refresh();

		yield* outcomes({
			draft: [field("name"), "Alice draft"],
			rechecks: [rechecks(), ["alice"]],
		});
	},
);

invoices.it(
	"switching to Bob shows his line and releases Alice's registry",
	[aliceEditing()],
	function* ({ field, registry, shownLine, showSession }) {
		yield* showSession("bob");

		yield* outcomes({
			"Alice's registry": [registry("alice"), "released"],
			name: [field("name"), "Envelope"],
			"shown line": [shownLine(), "Envelope / 80"],
		});
	},
);

invoices.it(
	"signing out shows the signed-out screen and releases Bob's registry",
	[bobAfterAlice()],
	function* ({ registry, screenText, showSession }) {
		yield* showSession(undefined);

		yield* outcomes({
			"Bob's registry": [registry("bob"), "released"],
			screen: [screenText(), "Signed out"],
		});
	},
);
