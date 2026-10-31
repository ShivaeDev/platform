import { expect } from "vitest";
import { requiredScreen } from "#test/requiredScreen.ts";

requiredScreen.it("leaving an empty required name displays its custom message", [], function* ({ leaveName, message }) {
	expect(yield* message()).toBeUndefined();

	yield* leaveName();

	expect(yield* message()).toBe("Enter your name");
});
