import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deniedStory, readable, rejected, watching } from "#test/deniedStory.ts";

for (const delivery of ["hints", "pushed"] as const) {
	for (const rejection of ["denied", "NotFound", "Rejected"] as const) {
		deniedStory.it(
			`${delivery}: ${rejection} settles after one policy check for a minute`,
			[rejected(rejection), watching(delivery)],
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
	deniedStory.it(
		`${delivery}: signing in reopens a denied subscription exactly once`,
		[watching(delivery)],
		function* ({ attempts, minutePasses, shown, signIn }) {
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
		`${delivery}: a matching change hint reopens a settled denial`,
		[watching(delivery)],
		function* ({ allow, announce, attempts, shown, untilLive }) {
			expect(yield* shown()).toBe("failed with read denied");
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
		`${delivery}: losing access publishes the denial and settles the open subscription`,
		[readable(), watching(delivery)],
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
		`${delivery}: a matching hint rechecks a still-denied subscription once`,
		[watching(delivery)],
		function* ({ announce, attempts, minutePasses, policyChecks, shown }) {
			yield* announce(1);
			yield* minutePasses();

			yield* outcomes([
				["policy checks", () => policyChecks(), 2],
				["query", () => shown(), "failed with read denied"],
				["subscriptions", () => attempts(), 2],
			]);
		},
	);
	deniedStory.it(
		`${delivery}: resume and unrelated hints leave a denial settled`,
		[watching(delivery)],
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
}
