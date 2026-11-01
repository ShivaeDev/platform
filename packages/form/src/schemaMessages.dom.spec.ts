import { expect } from "vitest";
import { refinementScreen } from "#test/refinementScreen.ts";

refinementScreen.it("submitting mismatched passwords renders their whole-form refinement message", [], function* ({ message, submit }) {
	expect(yield* message()).toBeUndefined();

	yield* submit();

	expect(yield* message()).toBe("Passwords must match");
});
