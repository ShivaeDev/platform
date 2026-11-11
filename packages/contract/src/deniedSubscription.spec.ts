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
	"pushed: restored access and a matching change leave a refusal settled",
	[watching()],
	function* ({ allow, announce, attempts, shown, minutePasses }) {
		expect(yield* shown()).toBe("failed with read denied");
		allow();

		yield* announce(1);
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
deniedStory.it(
	"pushed: a matching hint leaves a still-denied subscription settled",
	[watching()],
	function* ({ announce, attempts, minutePasses, policyChecks, shown }) {
		yield* announce(1);
		yield* minutePasses();

		yield* outcomes([
			["policy checks", () => policyChecks(), 1],
			["query", () => shown(), "failed with read denied"],
			["subscriptions", () => attempts(), 1],
		]);
	},
);
deniedStory.it(
	"pushed: resume and unrelated hints leave a denial settled",
	[watching()],
	function* ({ announce, attempts, minutePasses, policyChecks, resume, shown }) {
		resume();
		yield* announce(2);
		yield* minutePasses();

		yield* outcomes([
			["policy checks", () => policyChecks(), 1],
			["query", () => shown(), "failed with read denied"],
			["subscriptions", () => attempts(), 1],
		]);
	},
);
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
	"pushed: matching changes can still recover other expected rejections",
	[rejected("NotFound"), watching()],
	function* ({ allow, announce, attempts, shown, untilLive }) {
		expect(yield* shown()).toBe("failed with not found");
		allow();

		yield* announce(1);
		yield* untilLive();

		yield* outcomes([
			["query", () => shown(), "Alice's record"],
			["subscriptions", () => attempts(), 2],
		]);
	},
);
deniedStory.it(
	"pushed: a query without reads stays settled on NotFound through a command declaring its record, until an explicit refresh",
	[rejected("NotFound"), watching("unkeyed")],
	function* ({ allow, attempts, commandSucceeds, minutePasses, refresh, shown }) {
		expect(yield* shown()).toBe("failed with not found");
		allow();

		yield* commandSucceeds();
		yield* minutePasses();

		yield* outcomes([
			["query after the command", () => shown(), "failed with not found"],
			["subscriptions after the command", () => attempts(), 1],
		]);

		yield* refresh();

		yield* outcomes([
			["query after the refresh", () => shown(), "Alice's record"],
			["subscriptions after the refresh", () => attempts(), 2],
		]);
	},
);
