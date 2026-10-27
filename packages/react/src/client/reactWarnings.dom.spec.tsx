import { afterAll, expect } from "vitest";
import { warningScreen } from "#test/warningScreen.tsx";

const originalError = console.error;
afterAll(() => {
	expect(console.error).toBe(originalError);
});

warningScreen.it("reads a real React warning without asserting it away", [], function* ({ openWarningScreen, warnings }) {
	const view = yield* openWarningScreen();
	expect(view.container.querySelector("input")?.value).toBe("Uneditable screen field");
	expect(warnings()).toEqual({
		caughtErrors: [],
		consoleErrors: [[expect.stringContaining("You provided a `value` prop to a form field without an `onChange` handler")]],
	});
});

warningScreen.it("reads no warnings from a clean screen", [], function* ({ openCleanScreen, warnings }) {
	const view = yield* openCleanScreen();
	expect(view.container.textContent).toBe("Screen ready");
	expect(warnings()).toEqual({ caughtErrors: [], consoleErrors: [] });
});

warningScreen.it("leaves a declared caught error out of the readout", [], function* ({ openFailedScreen, expectCaughtError, warnings }) {
	const failure = new Error("Expected screen failure");
	const view = yield* openFailedScreen(
		failure,
		expectCaughtError((error) => error === failure),
	);
	expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Screen unavailable");
	expect(warnings()).toEqual({ caughtErrors: [], consoleErrors: [] });
});

warningScreen.it("reads an undeclared caught React error without printing it", [], function* ({ openFailedScreen, warnings }) {
	const failure = new TypeError("Unexpected screen failure");
	yield* openFailedScreen(failure);
	expect(warnings()).toEqual({ caughtErrors: [failure], consoleErrors: [] });
});

warningScreen.it("reads a caught error that does not match its declaration", [], function* ({ openFailedScreen, expectCaughtError, warnings }) {
	const failure = new TypeError("Unexpected screen failure");
	yield* openFailedScreen(
		failure,
		expectCaughtError((error) => error instanceof RangeError),
	);
	expect(warnings()).toEqual({ caughtErrors: [failure], consoleErrors: [] });
});

warningScreen.it.fails("restores console.error when the story fails after rendering a warning", [], function* ({ openWarningScreen, warnings }) {
	yield* openWarningScreen();
	expect(warnings().consoleErrors).not.toEqual([]);
	throw new Error("Story failed after rendering");
});
