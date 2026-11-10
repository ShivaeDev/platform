import { expect } from "vitest";
import { lessThan } from "@shivaedev/test-story/server/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reconnectSessions } from "#test/reconnect/sessions.tsx";

reconnectSessions.it("a dropped socket keeps alice's account through a server outage without rechecking her session", [], function* (story) {
	expect(yield* story.shown()).toContain("Alice's account");
	yield* story.serverUnavailable();

	yield* story.dropSocket();
	yield* story.reconnectIntervalPasses();

	yield* outcomes([
		["screen during outage", story.shown, expect.stringContaining("Alice's account")],
		["session reads", story.checks, ["get-session"]],
	]);

	yield* story.serverReturns();
	yield* story.waitForLive();

	yield* outcomes([
		["recovered screen", story.shown, expect.stringContaining("Alice's account")],
		["session reads", story.checks, ["get-session"]],
	]);
});

reconnectSessions.it(
	"an authentication refusal retries unreachable session checks with backoff and keeps alice's account until recovery",
	[],
	function* (story) {
		yield* story.failSessionChecks();
		yield* story.refuseReconnect();

		yield* story.dropSocket();
		yield* story.reconnectIntervalPasses();
		yield* story.nextCheck();
		yield* story.retryIntervalPasses("1 second");
		yield* story.retryIntervalPasses("2 seconds");

		yield* outcomes([
			["retained screen", story.shown, expect.stringContaining("Alice's account")],
			["retry intervals", story.checkIntervals, [1000, 2000]],
		]);

		yield* story.restoreSessionChecks();
		yield* story.retryIntervalPasses("4 seconds");

		expect(yield* story.shown()).toContain("Alice's account");
	},
);

for (const event of ["online", "visibilitychange"] as const) {
	reconnectSessions.it(
		`${event} immediately retries an unreachable check and a definite signed-out answer leaves alice's account`,
		[],
		function* (story) {
			yield* story.failSessionChecks();
			yield* story.refuseReconnect();
			yield* story.dropSocket();
			yield* story.reconnectIntervalPasses();
			yield* story.nextCheck();
			expect(yield* story.shown()).toContain("Alice's account");
			yield* story.signedOutAnswer();

			yield* story.resume(event);
			yield* story.nextCheck();

			yield* outcomes([
				["signed-out screen", story.shown, "Sign in"],
				["immediate retry", story.checkIntervals, [lessThan(800)]],
			]);
		},
	);
}

reconnectSessions.it(
	"sign-out unmounts the signed-in tree until its session refetch answers, so sign-in runs no stale account query",
	[],
	function* (story) {
		expect(yield* story.shown()).toContain("Alice's account");

		yield* story.signOut();

		expect(yield* story.shown()).toBe("");
		yield* story.signOutAnswers();
		yield* story.visitSignIn();
		expect(yield* story.shown()).toBe("");
		yield* story.releaseSessionRead();

		yield* outcomes([
			["signed-out screen", story.shown, "Sign in"],
			["failed signed-in queries", story.queryErrors, []],
			["server authentication refusals", story.refusedAccountRequests, []],
		]);
	},
);

reconnectSessions.it("a refused sign-out releases the hold, restores alice's account and clears sign-out intent", [], function* (story) {
	yield* story.signOut();
	expect(yield* story.shown()).toBe("");

	yield* story.signOutRefused();
	yield* story.waitForLive();

	yield* outcomes([
		["restored account", story.shown, expect.stringContaining("Alice's account")],
		["route intent", story.signOutIntent, "ordinary visit"],
	]);
});

reconnectSessions.it(
	"a successful sign-out stays held through an unreachable session refetch until an online check confirms signed out",
	[],
	function* (story) {
		yield* story.signOut();
		yield* story.signOutAnswers();
		yield* story.failSessionChecks();

		yield* story.releaseSessionRead();
		yield* story.nextCheck();

		expect(yield* story.shown()).toBe("");
		yield* story.restoreSessionChecks();
		yield* story.resume("online");
		yield* story.releaseSessionRead();
		yield* story.nextCheck();

		expect(yield* story.shown()).toBe("Sign in");
	},
);

reconnectSessions.it("foreground restarts an in-flight session check and keeps alice's account until the signed-out answer", [], function* (story) {
	yield* story.holdSessionChecks();
	yield* story.refuseReconnect();
	yield* story.dropSocket();
	yield* story.reconnectIntervalPasses();
	yield* story.nextSessionRequest();
	expect(yield* story.shown()).toContain("Alice's account");

	yield* story.resume("visibilitychange");
	yield* story.nextSessionRequest();

	yield* outcomes([
		["retained screen", story.shown, expect.stringContaining("Alice's account")],
		["session requests", story.checks, ["get-session", "get-session", "get-session"]],
	]);
	yield* story.signedOutAnswer();
	yield* story.releaseSessionRead();

	expect(yield* story.shown()).toBe("Sign in");
});
