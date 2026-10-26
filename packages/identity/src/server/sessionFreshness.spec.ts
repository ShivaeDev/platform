import { expect } from "vitest";
import { revalidationInterval, streamSession } from "#test/rpc/streamSession.ts";

for (const method of ["Identity", "Profile", "Accounts", "Optional"] as const) {
	streamSession.it(
		`${method} streams end after sign-out even while idle`,
		[revalidationInterval("5 seconds")],
		function* ({ start, send, next, checked, signout, advance, userId }) {
			const ended = yield* start(method);
			yield* send("before");
			expect(yield* next()).toBe(`${userId()}:before`);
			yield* checked();
			yield* signout();
			yield* advance("5 seconds");
			expect(yield* ended).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		},
	);
}

streamSession.it(
	"an anonymous optional stream keeps delivering across revalidation intervals",
	[],
	function* ({ start, send, next, checked, advance }) {
		yield* start("Optional", false);
		yield* send("before");
		expect(yield* next()).toBe("anonymous:before");
		yield* checked();
		yield* advance("30 seconds");
		yield* send("after");
		expect(yield* next()).toBe("anonymous:after");
	},
);

streamSession.it(
	"the default interval survives a session-store blip and checks again",
	[],
	function* ({ start, send, next, checked, blip, advance, signout, userId }) {
		const ended = yield* start("Identity");
		yield* send("before");
		expect(yield* next()).toBe(`${userId()}:before`);
		yield* checked();
		yield* blip();
		yield* advance("30 seconds");
		yield* checked();
		yield* send("after blip");
		expect(yield* next()).toBe(`${userId()}:after blip`);
		yield* advance("30 seconds");
		yield* checked();
		yield* send("after recovery");
		expect(yield* next()).toBe(`${userId()}:after recovery`);
		yield* signout();
		yield* advance("30 seconds");
		expect(yield* ended).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	},
);
