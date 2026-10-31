import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { invoices, oneShotLine, oneShotSaveHeld, theirStapler } from "#test/invoiceStories.ts";

invoices.it(
	"a one-shot edit saves against its opening version without reading the line",
	[oneShotLine()],
	function* ({ completed, lineReads, save, storedLine, type }) {
		yield* type("name", "  blue stapler ");

		yield* save();

		yield* outcomes({
			completed: [completed(), "Completed 7: Blue stapler / 150 (version 4)"],
			"line reads": [lineReads(), 0],
			stored: [storedLine(7), { id: 7, name: "Blue stapler", quantity: 150, version: 4 }],
		});
	},
);

invoices.it(
	"input typed while a one-shot save waits survives its completion",
	[oneShotSaveHeld()],
	function* ({ completed, field, finishHeld, status, type }) {
		yield* type("name", "Red stapler");

		yield* finishHeld();

		yield* outcomes({
			completed: [completed(), "Completed 7: Blue stapler / 150 (version 4)"],
			name: [field("name"), "Red stapler"],
			status: [status(), "Unsaved"],
		});
	},
);

invoices.it(
	"a one-shot save against a stale version shows the conflict and keeps the input",
	[oneShotLine()],
	function* ({ alerts, completed, field, save, serverEdits, status, storedLine, type }) {
		yield* type("name", "My stapler");
		yield* serverEdits(theirStapler);

		yield* save();

		yield* outcomes({
			alerts: [alerts(), ["This line changed. Reopen it to use the latest version."]],
			completed: [completed(), "none"],
			name: [field("name"), "My stapler"],
			quantity: [field("quantity"), "150"],
			status: [status(), "Unsaved"],
			stored: [storedLine(7), { ...theirStapler }],
		});
	},
);
