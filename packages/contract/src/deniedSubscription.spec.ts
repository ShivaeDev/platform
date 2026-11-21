import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deniedStory, readable, rejected, watching } from "#test/deniedStory.ts";

deniedStory.it(
	"pushed: restoring access after a live denial recovers on the next server hint",
	[readable(), watching()],
	function* ({ allow, announceOnServer, attempts, revoke, shown, untilFailed, untilLive }) {
		expect(yield* shown()).toBe("Alice's record");
		revoke();
		yield* announceOnServer();
		yield* untilFailed();
		expect(yield* shown()).toBe("failed with read denied");

		allow();
		yield* announceOnServer();
		yield* untilLive();

		yield* outcomes([
			["query", () => shown(), "Alice's record"],
			["subscriptions", () => attempts(), 1],
		]);
	},
);

deniedStory.it(
	"pushed: an explicit refresh recovers a denied query after access is restored",
	[watching()],
	function* ({ allow, attempts, refresh, shown }) {
		expect(yield* shown()).toBe("failed with read denied");
		allow();

		yield* refresh();

		yield* outcomes([
			["query", () => shown(), "Alice's record"],
			["subscriptions", () => attempts(), 2],
		]);
	},
);
for (const rejection of ["denied", "NotFound", "Rejected"] as const) {
	deniedStory.it(
		`pushed: ${rejection} settles after one policy check for a minute`,
		[rejected(rejection), watching()],
		function* ({ attempts, minutePasses, policyChecks, shown }) {
			const answer = { denied: "failed with read denied", NotFound: "failed with not found", Rejected: "failed with rejected" }[rejection];
			expect(yield* shown()).toBe(answer);

			yield* minutePasses();

			yield* outcomes([
				["policy checks", () => policyChecks(), 1],
				["query", () => shown(), answer],
				["subscriptions", () => attempts(), 1],
			]);
		},
	);
}
deniedStory.it("pushed: signing in reopens a denied subscription exactly once", [watching()], function* ({ attempts, minutePasses, shown, signIn }) {
	expect(yield* shown()).toBe("failed with read denied");

	yield* signIn();
	yield* minutePasses();

	yield* outcomes([
		["query", () => shown(), "Alice's record"],
		["subscriptions", () => attempts(), 2],
	]);
});
deniedStory.it(
	"pushed: restored access and the next reflected command leave a refusal settled",
	[watching()],
	function* ({ allow, attempts, commandSucceeds, shown, minutePasses }) {
		expect(yield* shown()).toBe("failed with read denied");
		allow();

		yield* commandSucceeds();
		yield* minutePasses();

		yield* outcomes([
			["query", () => shown(), "failed with read denied"],
			["subscriptions", () => attempts(), 1],
		]);
	},
);
deniedStory.it(
	"pushed: losing access publishes the denial and settles the open subscription",
	[readable(), watching()],
	function* ({ announceOnServer, attempts, minutePasses, revoke, shown, untilFailed }) {
		expect(yield* shown()).toBe("Alice's record");

		revoke();
		yield* announceOnServer();
		yield* untilFailed();
		yield* minutePasses();

		yield* outcomes([
			["query", () => shown(), "failed with read denied"],
			["subscriptions", () => attempts(), 1],
		]);
	},
);
deniedStory.it("pushed: resume leaves a denial settled", [watching()], function* ({ attempts, minutePasses, policyChecks, resume, shown }) {
	resume();
	yield* minutePasses();

	yield* outcomes([
		["policy checks", () => policyChecks(), 1],
		["query", () => shown(), "failed with read denied"],
		["subscriptions", () => attempts(), 1],
	]);
});
deniedStory.it(
	"pushed: a new viewer recovers a query whose mounted read lost access",
	[readable(), watching()],
	function* ({ announceOnServer, attempts, minutePasses, revoke, shown, signIn, untilFailed }) {
		revoke();
		yield* announceOnServer();
		yield* untilFailed();
		expect(yield* shown()).toBe("failed with read denied");

		yield* signIn();
		yield* minutePasses();

		yield* outcomes([
			["query", () => shown(), "Alice's record"],
			["subscriptions", () => attempts(), 2],
		]);
	},
);
deniedStory.it(
	"pushed: the next reflected command reopens a query without reads that failed with NotFound",
	[rejected("NotFound"), watching("unkeyed")],
	function* ({ allow, attempts, commandSucceeds, shown, untilLive }) {
		expect(yield* shown()).toBe("failed with not found");
		allow();

		yield* commandSucceeds();
		yield* untilLive();

		yield* outcomes([
			["query", () => shown(), "Alice's record"],
			["subscriptions", () => attempts(), 2],
		]);
	},
);
