import { expect } from "vitest";
import { rejectedNameScreen } from "#test/rejectedNameScreen.ts";

rejectedNameScreen.it(
	"focusing and leaving a rejected name unchanged keeps the server message",
	[],
	function* ({ focusName, leaveName, message, submit }) {
		yield* submit();
		yield* focusName();
		expect(yield* message()).toBe("Already used");

		yield* leaveName();

		expect(yield* message()).toBe("Already used");
	},
);

rejectedNameScreen.it("changing a rejected name clears the displayed server message", [], function* ({ enterName, message, submit }) {
	yield* submit();
	expect(yield* message()).toBe("Already used");

	yield* enterName("grace");

	expect(yield* message()).toBeUndefined();
});

rejectedNameScreen.it("emptying a rejected name displays client validation feedback", [], function* ({ enterName, message, submit }) {
	yield* submit();
	expect(yield* message()).toBe("Already used");

	yield* enterName("");

	expect(yield* message()).toBe("Required");
});
