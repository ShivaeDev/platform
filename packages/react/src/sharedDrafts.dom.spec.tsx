import { expect } from "vitest";
import { browserStorage, sharedDrafts } from "#test/sharedDrafts.ts";

sharedDrafts.it(
	"finishing an older submission leaves the second editor's newer draft available after reopening",
	[],
	function* ({ finishSave, open, shown, submit, type }) {
		yield* open("first");
		yield* open("second");
		yield* type("first", "name", "Submitted");
		yield* submit();
		yield* type("second", "name", "Newer answer");
		expect(yield* shown("second")).toEqual({ name: "Newer answer", quantity: "300" });

		yield* finishSave();

		yield* open("second");
		expect(yield* shown("second")).toEqual({ name: "Newer answer", quantity: "300" });
	},
);

sharedDrafts.it("observed writes adopt untouched fields while keeping the second editor's typing", [], function* ({ open, shown, type }) {
	yield* open("first");
	yield* open("second");
	yield* type("first", "name", "Shared answer");
	yield* type("second", "name", "Local answer");
	expect(yield* shown("second")).toEqual({ name: "Local answer", quantity: "300" });

	yield* type("first", "quantity", "350");

	expect(yield* shown("second")).toEqual({ name: "Local answer", quantity: "350" });
});

sharedDrafts.it("an untouched editor follows successive observed draft changes", [], function* ({ open, shown, type }) {
	yield* open("first");
	yield* open("second");
	yield* type("first", "name", "First answer");
	expect(yield* shown("second")).toEqual({ name: "First answer", quantity: "300" });

	yield* type("first", "name", "Second answer");

	expect(yield* shown("second")).toEqual({ name: "Second answer", quantity: "300" });
});

sharedDrafts.it("a completed submission clears its own asynchronous stored draft", [], function* ({ finishSave, open, shown, submit, type }) {
	yield* open("first");
	yield* type("first", "name", "Submitted");
	yield* submit();

	yield* finishSave();

	yield* open("second");
	expect(yield* shown("second")).toEqual({ name: "Paper", quantity: "300" });
});

sharedDrafts.it(
	"submitting locally retained input leaves the newer observed draft available",
	[],
	function* ({ finishSave, open, shown, submit, type }) {
		yield* open("first");
		yield* open("second");
		yield* type("first", "name", "Local answer");
		yield* type("second", "name", "Newer answer");
		expect(yield* shown("first")).toEqual({ name: "Local answer", quantity: "300" });

		yield* submit();
		yield* finishSave();

		yield* open("second");
		expect(yield* shown("second")).toEqual({ name: "Newer answer", quantity: "300" });
	},
);

sharedDrafts.it("a browser storage event reaches an untouched editor", [browserStorage()], function* ({ browserChanged, open, shown, type }) {
	yield* open("first");
	yield* open("second");
	yield* type("first", "name", "Shared answer");
	expect(yield* shown("second")).toEqual({ name: "Paper", quantity: "300" });

	yield* browserChanged();

	expect(yield* shown("second")).toEqual({ name: "Shared answer", quantity: "300" });
});

sharedDrafts.it(
	"browser storage keeps the newer draft after an older submission completes",
	[browserStorage()],
	function* ({ finishSave, open, shown, submit, type }) {
		yield* open("first");
		yield* open("second");
		yield* type("first", "name", "Submitted");
		yield* submit();
		yield* type("second", "name", "Newer answer");

		yield* finishSave();

		yield* open("second");
		expect(yield* shown("second")).toEqual({ name: "Newer answer", quantity: "300" });
	},
);

sharedDrafts.it("an editor follows observed input after its own submission succeeds", [], function* ({ finishSave, open, shown, submit, type }) {
	yield* open("first");
	yield* type("first", "name", "Submitted");
	yield* submit();
	yield* finishSave();
	yield* open("second");
	expect(yield* shown("first")).toEqual({ name: "Submitted", quantity: "300" });

	yield* type("second", "name", "Next answer");

	expect(yield* shown("first")).toEqual({ name: "Next answer", quantity: "300" });
});
