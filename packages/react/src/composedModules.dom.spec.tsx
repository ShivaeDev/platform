import { expect } from "vitest";
import { composedModules } from "#test/composedModules.tsx";

composedModules.it("a session renders two composed live modules", [], function* ({ open, shown }) {
	yield* open();
	expect(yield* shown()).toEqual(["Notes", "Tasks"]);
});
