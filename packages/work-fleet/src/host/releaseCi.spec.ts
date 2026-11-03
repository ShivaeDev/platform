import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host, storedWork } from "#test/hostStory.ts";

const head = "a".repeat(40);
const ciHold = { head, paths: [".github/workflows/ci.yml"] };

host.it(
	"release-ci releases only the held head through the daemon without a client database connection",
	[storedWork("one", "waiting", { ciHold })],
	function* (daemon) {
		const released = yield* daemon.cli(["release-ci", "one", head]);

		yield* outcomes([
			["CLI result", () => Effect.succeed(released), { code: 0, stderr: "" }],
			["stored release", () => daemon.get("one"), { ciApprovedHead: head, step: "delivering" }],
		]);
		expect((yield* daemon.get("one")).ciHold).toBeUndefined();
	},
);

host.it("release-ci refuses a different head and preserves the hold", [storedWork("one", "waiting", { ciHold })], function* (daemon) {
	const refused = yield* daemon.cli(["release-ci", "one", "b".repeat(40)]);

	yield* outcomes([
		["CLI refusal", () => Effect.succeed(refused), { code: 1, stderr: expect.stringContaining("The CI hold changed") }],
		["stored hold", () => daemon.get("one"), { ciHold, step: "waiting" }],
	]);
	expect((yield* daemon.get("one")).ciApprovedHead).toBeUndefined();
});
