import { expect } from "@effect/vitest";
import { delayedRefresh } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

for (const fail of [false, true]) {
	host.it(
		`CLI dispatch records acceptance before a blocked first main refresh, failure=${fail}`,
		[approvedWork(["one"]), delayedRefresh(fail)],
		function* (daemon) {
			expect(yield* daemon.cli(["dispatch", "one"], { selection: "port" })).toEqual({
				code: 0,
				stderr: "",
				stdout: "one: dispatch recorded; preparing and launching in the background",
			});
			yield* daemon.awaitDelay();
			const accepted = yield* daemon.request("daemon.dispatch-status", { workId: "one" });
			expect(accepted).toMatchObject({ status: "pending", workId: "one" });
			const requestResult = yield* daemon.request("daemon.dispatch", { workId: "one" });
			expect(requestResult).toEqual(accepted);
			expect(yield* refusal(daemon.get("one"))).toMatch(/^not found: /u);
			expect(daemon.providerLaunches()).toHaveLength(0);
			const statusCliResult = yield* daemon.cli(["status", "one"], { selection: "port" });
			expect(statusCliResult.stdout).toContain("one  dispatch pending");
			if (fail) {
				yield* daemon.follow("watch", "watch", ["one"], { interval: 0.1 });
				yield* daemon.awaitSnapshot();
				expect(daemon.followerRunning("watch")).toBe(true);
				expect(daemon.followerOutput("watch")).toBe("");
				yield* daemon.releaseDelay();
				expect(yield* daemon.followerExit("watch")).toMatchObject({
					code: 0,
					stdout: expect.stringContaining("Dispatch failed: Git refresh unavailable"),
				});
			} else {
				yield* daemon.releaseDelay();
			}
			const outcome = yield* daemon.dispatchOutcome("one");
			expect(outcome).toMatchObject({ id: accepted?.id, status: fail ? "failed" : "completed" });
			if (fail) {
				expect(outcome.error).toBe("Git refresh unavailable");
				expect((yield* daemon.cli(["status", "one"], { selection: "port" })).stdout).toContain("one  dispatch failed: Git refresh unavailable");
			} else {
				expect((yield* daemon.get("one")).step).toBe("working");
				expect(daemon.providerLaunches()).toEqual([(yield* daemon.get("one")).attempts[0]?.operationId]);
			}
		},
	);
}
