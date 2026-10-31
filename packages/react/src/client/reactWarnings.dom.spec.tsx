import { afterAll, expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { warningScreen } from "#test/warningScreen.tsx";

const originalError = console.error;
afterAll(() => {
	expect(console.error).toBe(originalError);
});

warningScreen.it(
	"rendering a controlled field without onChange records React's warning and still shows the field",
	[],
	function* ({ field, openWarningScreen, warnings }) {
		yield* openWarningScreen();

		yield* outcomes({
			field: [field(), "Uneditable screen field"],
			warnings: [
				warnings(),
				{ caughtErrors: [], consoleErrors: [[expect.stringContaining("You provided a `value` prop to a form field without an `onChange` handler")]] },
			],
		});
	},
);

warningScreen.it("a clean screen records no warnings", [], function* ({ openCleanScreen, shown, warnings }) {
	yield* openCleanScreen();

	yield* outcomes({
		shown: [shown(), "Screen ready"],
		warnings: [warnings(), { caughtErrors: [], consoleErrors: [] }],
	});
});

warningScreen.it(
	"a caught error matching its declaration shows the boundary's alert and is left out of the warnings",
	[],
	function* ({ alert, expectCaughtError, openFailedScreen, warnings }) {
		const failure = new Error("Expected screen failure");

		yield* openFailedScreen(
			failure,
			expectCaughtError((error) => error === failure),
		);

		yield* outcomes({
			alert: [alert(), "Screen unavailable"],
			warnings: [warnings(), { caughtErrors: [], consoleErrors: [] }],
		});
	},
);

warningScreen.it("an undeclared caught error is recorded without being printed", [], function* ({ openFailedScreen, warnings }) {
	const failure = new TypeError("Unexpected screen failure");

	yield* openFailedScreen(failure);

	expect(yield* warnings()).toEqual({ caughtErrors: [failure], consoleErrors: [] });
});

warningScreen.it("a caught error that does not match its declaration is recorded", [], function* ({ expectCaughtError, openFailedScreen, warnings }) {
	const failure = new TypeError("Unexpected screen failure");

	yield* openFailedScreen(
		failure,
		expectCaughtError((error) => error instanceof RangeError),
	);

	expect(yield* warnings()).toEqual({ caughtErrors: [failure], consoleErrors: [] });
});

warningScreen.it.fails("a story that fails after rendering a warning still restores console.error", [], function* ({ openWarningScreen }) {
	yield* openWarningScreen();

	throw new Error("Story failed after rendering");
});
