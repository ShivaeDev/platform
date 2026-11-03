import { expect } from "vitest";
import { events, legacySaved, saved, unprojectableHistory } from "#test/kit.ts";

events.it(
	"a batch applies every projection per event and rebuild preserves that order",
	[],
	function* ({ appendWithAudit, rebuildCombined, storedAudit }) {
		yield* appendWithAudit();
		expect(yield* storedAudit()).toEqual(["Draft", "Draft, Published"]);

		yield* rebuildCombined();

		expect(yield* storedAudit()).toEqual(["Draft", "Draft, Published"]);
	},
);

events.it(
	"a rebuild reproduces the projected rows from stored events",
	[saved("draft", "Draft"), saved("publish", "Published", 1)],
	function* ({ eraseRows, rebuild, storedRows }) {
		const original = yield* storedRows();
		yield* eraseRows();
		expect(yield* storedRows()).toEqual([]);

		yield* rebuild();

		expect(yield* storedRows()).toEqual(original);
	},
);

events.it("rebuilding upcasts an old event into the current projection schema", [legacySaved], function* ({ rebuildUpgraded, storedRows }) {
	expect(yield* storedRows()).toEqual([]);

	yield* rebuildUpgraded();

	expect(yield* storedRows()).toEqual([{ name: "Original", stream: "alice" }]);
});

events.it(
	"rebuilding a different event version without an upcaster refuses it with a typed failure",
	[legacySaved],
	function* ({ rebuildWithoutUpcaster }) {
		const ending = yield* rebuildWithoutUpcaster();

		expect(ending).toBe("unsupported version 1, current 2");
	},
);

events.it(
	"rebuilding one projection preserves another projection's rows and progress",
	[saved("rename", "Original")],
	function* ({ catchUpAudit, rebuild, storedAudit }) {
		yield* catchUpAudit();
		expect(yield* storedAudit()).toEqual(["Original"]);

		yield* rebuild();
		yield* catchUpAudit();

		expect(yield* storedAudit()).toEqual(["Original"]);
	},
);

events.it(
	"a failed rebuild preserves the previous read model",
	[saved("rename", "Original"), unprojectableHistory],
	function* ({ rebuild, storedRows }) {
		expect(yield* storedRows()).toEqual([{ name: "Original", stream: "alice" }]);

		const ending = yield* rebuild();

		expect(ending).toBe("projection rejected");
		expect(yield* storedRows()).toEqual([{ name: "Original", stream: "alice" }]);
	},
);
