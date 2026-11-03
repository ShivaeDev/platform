import { expect } from "vitest";
import { earlyWriterHeld, events, laterWriterCommitted, saved } from "#test/kit.ts";

events.it("catch-up waits for rebuild to commit", [saved("rename", "Original")], function* ({ raceRebuildAndCatchUp }) {
	const ending = yield* raceRebuildAndCatchUp();

	expect(ending).toBe("waited for rebuild");
});

events.it(
	"consumer progress includes an earlier transaction that commits after a later stream was consumed",
	[earlyWriterHeld, laterWriterCommitted],
	function* ({ catchUp, commitEarlyWriter, storedRows }) {
		yield* catchUp();
		expect(yield* storedRows()).toEqual([{ name: "Later", stream: "beta" }]);

		yield* commitEarlyWriter();
		yield* catchUp();

		expect(yield* storedRows()).toEqual([
			{ name: "Early", stream: "alpha" },
			{ name: "Later", stream: "beta" },
		]);
	},
);

events.it("catching up after append does not apply a projection twice", [saved("rename", "Original")], function* ({ catchUp, storedRows }) {
	yield* catchUp();

	expect(yield* storedRows()).toEqual([{ name: "Original", stream: "alice" }]);
});
