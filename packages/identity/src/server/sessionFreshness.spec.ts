import { expect } from "vitest";
import { aliceSubscribesTo, anonymousSubscribesToOptional, revalidatesEvery, streamSession } from "#test/rpc/streamSession.ts";

for (const method of ["Identity", "Profile", "Accounts", "Optional"] as const) {
	streamSession.it(
		`alice's idle ${method} stream ends as unauthorized at the app's next five-second check after she signs out`,
		[revalidatesEvery("5 seconds"), aliceSubscribesTo(method)],
		function* ({ aliceSignsOut, echo, revalidationIntervalPasses, streamEnd }) {
			expect(yield* echo("hello")).toBe("alice: hello");

			yield* aliceSignsOut();

			yield* revalidationIntervalPasses();
			expect(yield* streamEnd()).toBe("unauthorized");
		},
	);
}

streamSession.it(
	"without an app interval, alice's stream is checked after 30 seconds and ends once she has signed out",
	[aliceSubscribesTo("Identity")],
	function* ({ aliceSignsOut, revalidationIntervalPasses, streamEnd }) {
		yield* aliceSignsOut();

		yield* revalidationIntervalPasses();
		expect(yield* streamEnd()).toBe("unauthorized");
	},
);

streamSession.it(
	"an anonymous Optional stream keeps delivering after the default interval passes",
	[anonymousSubscribesToOptional],
	function* ({ echo, timePasses }) {
		expect(yield* echo("hello")).toBe("anonymous: hello");

		yield* timePasses("30 seconds");

		expect(yield* echo("still here")).toBe("anonymous: still here");
	},
);

for (const method of ["Identity", "Profile", "Accounts", "Optional"] as const) {
	streamSession.it(
		`a session-store outage ends alice's idle ${method} stream as auth unavailable at the next check`,
		[aliceSubscribesTo(method)],
		function* ({ echo, revalidationIntervalPasses, sessionStoreBlips, streamEnd }) {
			expect(yield* echo("hello")).toBe("alice: hello");

			yield* sessionStoreBlips();
			yield* revalidationIntervalPasses();

			expect(yield* streamEnd()).toBe("auth unavailable");
		},
	);
}
