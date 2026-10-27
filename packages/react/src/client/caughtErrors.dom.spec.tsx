import { expect } from "vitest";
import { caughtErrorScreen, RouteFailure } from "#test/caughtErrorScreen.tsx";

caughtErrorScreen.it("routes caught errors through React root options", [], function* ({ openRoute }) {
	const failure = new RouteFailure("Route unavailable");
	const caught: unknown[] = [];
	const view = yield* openRoute(failure, { onCaughtError: (error, info) => caught.push({ error, stack: info.componentStack }) });
	expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(failure.message);
	expect(caught).toEqual([{ error: failure, stack: expect.any(String) }]);
});

caughtErrorScreen.it("keeps the warnings guard for an expected route failure", [], function* ({ openRoute, expectCaughtError }) {
	const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
	const view = yield* openRoute(new RouteFailure("Route unavailable"), { onCaughtError });
	expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Route unavailable");
});

caughtErrorScreen.it.fails("rejects an unexpected caught route error", [], function* ({ openRoute, expectCaughtError }) {
	const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
	yield* openRoute(new RouteFailure("Expected route failure"), { onCaughtError });
	yield* openRoute(new TypeError("Unexpected route defect"), { onCaughtError });
});

caughtErrorScreen.it.fails("rejects a React warning alongside an expected route failure", [], function* ({ openRoute, expectCaughtError }) {
	const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
	const view = yield* openRoute(new RouteFailure("Route unavailable"), { onCaughtError }, true);
	expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Route unavailable");
});

caughtErrorScreen.it.fails("rejects an expected error that never happens", [], function* ({ openRoute, expectCaughtError }) {
	const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
	const view = yield* openRoute(null, { onCaughtError });
	expect(view.container.querySelector("h1")?.textContent).toBe("Route ready");
});

caughtErrorScreen.it.fails(
	"rejects unrelated console errors alongside an expected route failure",
	[],
	function* ({ openRoute, expectCaughtError, logError }) {
		const onCaughtError = expectCaughtError((error) => error instanceof RouteFailure);
		yield* openRoute(new RouteFailure("Route unavailable"), { onCaughtError });
		yield* logError("Unexpected screen error");
	},
);
