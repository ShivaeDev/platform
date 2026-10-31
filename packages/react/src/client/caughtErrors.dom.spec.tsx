import { expect } from "vitest";
import { caughtErrorScreen, RouteFailure } from "#test/caughtErrorScreen.tsx";

caughtErrorScreen.it("a route's caught error reaches the root's onCaughtError with its component stack", [], function* ({ openRoute }) {
	const failure = new RouteFailure("Route unavailable");
	const caught: unknown[] = [];

	yield* openRoute(failure, { onCaughtError: (error, info) => caught.push({ error, stack: typeof info.componentStack }) });

	expect(caught).toEqual([{ error: failure, stack: "string" }]);
});

caughtErrorScreen.it(
	"a route failure declared to the warnings guard shows the route's alert and passes the story",
	[],
	function* ({ alert, expectCaughtError, openRoute }) {
		const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);

		yield* openRoute(new RouteFailure("Route unavailable"), { onCaughtError });

		expect(yield* alert()).toBe("Route unavailable");
	},
);

caughtErrorScreen.it.fails(
	"the warnings guard fails a story whose route throws an error it was not told to expect",
	[],
	function* ({ expectCaughtError, openRoute }) {
		const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
		yield* openRoute(new RouteFailure("Expected route failure"), { onCaughtError });

		yield* openRoute(new TypeError("Unexpected route defect"), { onCaughtError });
	},
);

caughtErrorScreen.it.fails(
	"the warnings guard fails a story whose expected route failure renders a React warning",
	[],
	function* ({ expectCaughtError, openRoute }) {
		const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);

		yield* openRoute(new RouteFailure("Route unavailable"), { onCaughtError }, true);
	},
);

caughtErrorScreen.it.fails(
	"the warnings guard fails a story whose expected route failure never happens",
	[],
	function* ({ expectCaughtError, heading, openRoute }) {
		const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);

		yield* openRoute(null, { onCaughtError });

		expect(yield* heading()).toBe("Route ready");
	},
);

caughtErrorScreen.it.fails(
	"the warnings guard fails a story that logs an unrelated console error beside an expected route failure",
	[],
	function* ({ expectCaughtError, logError, openRoute }) {
		const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
		yield* openRoute(new RouteFailure("Route unavailable"), { onCaughtError });

		yield* logError("Unexpected screen error");
	},
);
