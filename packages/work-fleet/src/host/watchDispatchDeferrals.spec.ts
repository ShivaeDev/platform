import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";

for (const [reason, step, config, fields] of [
	[
		"waiting for open PRs to merge",
		"waiting",
		{ openPullRequests: { ease: 0, floor: 0, max: 1 } },
		{ result: { head: HEAD, kind: "change", paths: [], pr: PR } },
	],
	["review or repair launches to go first", "reviewing", { concurrency: 1 }, {}],
] as const) {
	host.it(
		`the default watch keeps ${reason} deferrals quiet`,
		[
			boardWork({ "held.md": task("held", "approved"), "one.md": task("one", "approved"), "signal.md": task("signal", "approved") }, config),
			storedWork("held", step, { attentionOwner: "automation", ...fields }),
		],
		function* (daemon) {
			yield* daemon.watchDefault({ follow: true, json: true, prEvents: false });
			yield* daemon.awaitSnapshot();
			yield* daemon.acknowledgeDispatch("one");
			const deferred = yield* daemon.dispatchOutcome("one");

			expect(deferred.error).toContain(reason);
			yield* daemon.request("daemon.dispatch", { now: true, workId: "signal" });
			const signal = yield* daemon.waitForRecord("signal", (record) => record.stage === "working" && record.attempts.at(-1)?.receipt !== undefined);
			daemon.finishTurn(signal, "FLEET_QUESTION: Confirm scope");
			yield* daemon.reconcile("signal");
			yield* daemon.awaitEvent("waiting-on-orchestrator");
			expect(daemon.eventLines()).toEqual([{ kind: "waiting-on-orchestrator", reason: "Confirm scope", workId: "signal" }]);
		},
	);
}

host.it(
	"a substantiated stalled release remains actionable",
	[
		storedWork("one", "waiting", {
			attentionOwner: "automation",
			blocker: "Waiting for release PR #7 to merge",
			releaseWindow: { observedAt: 300_000, pr: PR, progress: HEAD, reason: "Removed from the merge queue for failed checks", since: 0 },
		}),
	],
	function* (daemon) {
		yield* daemon.watchDefault({ follow: true, json: true, prEvents: false });
		yield* daemon.awaitEvent("waiting-on-orchestrator");

		expect(daemon.eventLines()).toEqual([
			{
				kind: "waiting-on-orchestrator",
				reason: `Release PR #7 (${PR}) is stuck: Removed from the merge queue for failed checks; holds 1 PR`,
				workId: "one",
			},
		]);
	},
);
