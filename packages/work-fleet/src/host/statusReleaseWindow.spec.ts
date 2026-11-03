import { expect } from "@effect/vitest";
import { host, storedWork } from "#test/hostStory.ts";

const PR = "https://github.com/example/repository/pull/8";
const HELD = "Waiting for release PR #8 to merge";
const REASON = "Removed from the merge queue for failed checks";
const window = { observedAt: 300_100, pr: PR, progress: "release-head", reason: REASON, since: 100 };
const stalled = `Release PR #8 (${PR}) is stuck: ${REASON}; holds 1 PR`;

for (const scenario of [
	{ blocker: HELD, name: "a stalled release", owner: "orchestrator", releaseWindow: window, shown: stalled },
	{ blocker: HELD, name: "a release below the stall threshold", owner: "automation", releaseWindow: { ...window, observedAt: 300_099 }, shown: HELD },
	{
		blocker: HELD,
		name: "a release making progress",
		owner: "automation",
		releaseWindow: { ...window, reason: undefined, since: undefined },
		shown: HELD,
	},
	{
		blocker: "Waiting for required checks",
		name: "work without a release window",
		owner: "automation",
		releaseWindow: undefined,
		shown: "Waiting for required checks",
	},
] as const) {
	host.it(
		`daemon overview, item status and follower agree for ${scenario.name}`,
		[storedWork("one", "waiting", { attentionOwner: "automation", blocker: scenario.blocker, releaseWindow: scenario.releaseWindow })],
		function* (daemon) {
			const expected = { attentionOwner: scenario.owner, blocker: scenario.shown, stage: "waiting", workId: "one" };

			const overview = yield* daemon.status();

			expect(overview.waiting[scenario.owner]).toEqual([expect.objectContaining(expected)]);

			const item = yield* daemon.requestStatus("one");

			expect(item.waiting[scenario.owner]).toEqual([expect.objectContaining(expected)]);

			yield* daemon.subscribe(["one"]);

			expect(daemon.snapshots()).toEqual([[expect.objectContaining(expected)]]);
		},
	);
}
