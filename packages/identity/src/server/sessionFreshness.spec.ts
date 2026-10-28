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

streamSession.it(
	"when the session store blips at a check, alice's stream stays open",
	[aliceSubscribesTo("Identity")],
	function* ({ echo, revalidationIntervalPasses, sessionStoreBlips }) {
		yield* sessionStoreBlips();

		yield* revalidationIntervalPasses();

		expect(yield* echo("hello")).toBe("alice: hello");
	},
);

streamSession.it(
	"after a blipped check, the next check still ends alice's stream once she has signed out",
	[aliceSubscribesTo("Identity")],
	function* ({ aliceSignsOut, revalidationIntervalPasses, sessionStoreBlips, streamEnd }) {
		yield* sessionStoreBlips();
		yield* revalidationIntervalPasses();

		yield* aliceSignsOut();

		yield* revalidationIntervalPasses();
		expect(yield* streamEnd()).toBe("unauthorized");
	},
);
