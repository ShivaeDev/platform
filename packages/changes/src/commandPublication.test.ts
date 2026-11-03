import { expect } from "vitest";
import { commandPublication } from "#test/commandPublication.ts";

commandPublication.it("the default command port invalidates the named local subscribers", [], function* ({ announced, publish }) {
	yield* publish(["notes:1"]);

	expect(yield* announced()).toEqual(["notes:1"]);
});
