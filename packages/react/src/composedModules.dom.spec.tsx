import { expect } from "vitest";
import { composedModules } from "#test/composedModules.tsx";

for (const window of [0, "100 millis"] as const) {
	composedModules.it(`a session renders two composed modules and mounts both bindings with a ${window} live window`, [], function* ({ open, shown }) {
		yield* open(window);

		expect(yield* shown()).toEqual([`Notes (${window})`, `Tasks (${window})`]);
	});
}

composedModules.it("an explicit binding list applies the session window only to its selected module", [], function* ({ open, shown }) {
	yield* open(0, ["Notes"]);

	expect(yield* shown()).toEqual(["Notes (0)", "Tasks (20 millis)"]);
});
