import { expect } from "@effect/vitest";
import { notes, stock } from "#test/drafts.ts";

notes.it(
	"reverting after a refresh restores the refreshed name, not the starting one",
	[notes.edited("name", "Edited"), notes.refreshReceived({ name: "Second" })],
	function* ({ revert, shown }) {
		expect(yield* shown("name")).toBe("Edited");

		yield* revert();

		expect(yield* shown("name")).toBe("Second");
	},
);

notes.it("a refresh replaces the name while nothing is edited", [], function* ({ refresh, shown }) {
	expect(yield* shown("name")).toBe("First");

	yield* refresh({ name: "Second" });

	expect(yield* shown("name")).toBe("Second");
});

stock.it(
	"a refresh updates the untouched quantity and keeps the edited name",
	[stock.edited("name", "Copy paper")],
	function* ({ refresh, shownValues }) {
		expect(yield* shownValues()).toEqual({ name: "Copy paper", quantity: "300" });

		yield* refresh({ name: "Printer paper", quantity: "350" });

		expect(yield* shownValues()).toEqual({ name: "Copy paper", quantity: "350" });
	},
);

notes.it("a refresh keeps a note added locally and takes the refreshed name", [notes.edited("note", "Local")], function* ({ refresh, shownValues }) {
	expect(yield* shownValues()).toEqual({ name: "First", note: "Local" });

	yield* refresh({ name: "Second" });

	expect(yield* shownValues()).toEqual({ name: "Second", note: "Local" });
});

notes.it(
	"reverting removes a note added locally that the server never sent",
	[notes.edited("note", "Local"), notes.refreshReceived({ name: "Second" })],
	function* ({ revert, shownValues }) {
		expect(yield* shownValues()).toEqual({ name: "Second", note: "Local" });

		yield* revert();

		expect(yield* shownValues()).toStrictEqual({ name: "Second" });
	},
);

notes.it(
	"a refresh that omits an untouched note removes it",
	[notes.startsWith({ name: "First", note: "Server" }), notes.edited("name", "Edited")],
	function* ({ refresh, shownValues }) {
		expect(yield* shownValues()).toEqual({ name: "Edited", note: "Server" });

		yield* refresh({ name: "Second" });

		expect(yield* shownValues()).toStrictEqual({ name: "Edited" });
	},
);
