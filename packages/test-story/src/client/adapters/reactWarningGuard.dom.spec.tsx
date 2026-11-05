import { expect } from "vitest";
import { guardScreen, ScreenFailure } from "#test/guardScreen.tsx";

guardScreen.it(
	"a screen failure declared to the warnings guard shows the screen's alert and passes the story",
	[],
	function* ({ alert, expectCaughtError, openScreen }) {
		const onCaughtError = expectCaughtError((error) => error instanceof ScreenFailure);

		yield* openScreen(new ScreenFailure("Screen unavailable"), { onCaughtError });

		expect(yield* alert()).toBe("Screen unavailable");
	},
);

guardScreen.it.fails(
	"the warnings guard fails a story whose screen throws an error it was not told to expect",
	[],
	function* ({ expectCaughtError, openScreen }) {
		const onCaughtError = expectCaughtError((error) => error instanceof ScreenFailure);
		yield* openScreen(new ScreenFailure("Expected screen failure"), { onCaughtError });

		yield* openScreen(new TypeError("Unexpected screen defect"), { onCaughtError });
	},
);

guardScreen.it.fails(
	"the warnings guard fails a story whose expected screen failure renders a React warning",
	[],
	function* ({ expectCaughtError, openScreen }) {
		const onCaughtError = expectCaughtError((error) => error instanceof ScreenFailure);

		yield* openScreen(new ScreenFailure("Screen unavailable"), { onCaughtError }, true);
	},
);

guardScreen.it.fails(
	"the warnings guard fails a story whose expected screen failure never happens",
	[],
	function* ({ expectCaughtError, heading, openScreen }) {
		const onCaughtError = expectCaughtError((error) => error instanceof ScreenFailure);

		yield* openScreen(null, { onCaughtError });

		expect(yield* heading()).toBe("Screen ready");
	},
);

guardScreen.it.fails(
	"the warnings guard fails a story that logs an unrelated console error beside an expected screen failure",
	[],
	function* ({ expectCaughtError, logError, openScreen }) {
		const onCaughtError = expectCaughtError((error) => error instanceof ScreenFailure);
		yield* openScreen(new ScreenFailure("Screen unavailable"), { onCaughtError });

		yield* logError("Unexpected screen error");
	},
);
