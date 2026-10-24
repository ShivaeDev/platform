import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { delayedRefresh } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, boardWork, host } from "#test/hostStory.ts";

for (const [fail, now] of [
	[false, false],
	[true, false],
	[false, true],
] as const) {
	host.it(
		`dispatch resumes after daemon restart: refresh failure=${fail}, immediate=${now}`,
		[approvedWork(["one"]), delayedRefresh(fail)],
		function* (daemon) {
			const accepted = yield* daemon.request("daemon.dispatch", { now, workId: "one" });
			expect(accepted.now).toBe(now ? true : undefined);
			yield* daemon.awaitDelay();
			if (fail) {
				yield* daemon.releaseDelay();
				expect((yield* daemon.dispatchOutcome("one")).status).toBe("failed");
			}
			yield* daemon.stop();
			expect(daemon.providerLaunches()).toHaveLength(0);
			daemon.removeDelay();
			yield* daemon.start();
			const request = fail ? yield* daemon.request("daemon.dispatch", { workId: "one" }) : accepted;
			if (fail) {
				expect(request.id).not.toBe(accepted.id);
			}
			expect(yield* daemon.dispatchOutcome("one")).toMatchObject({ id: request.id, status: "completed" });
			const record = yield* daemon.get("one");
			expect(record.step).toBe("working");
			expect(record.dispatchNow).toEqual(accepted.now === true ? { ignoreAreas: false } : undefined);
			expect(daemon.providerLaunches()).toHaveLength(1);
		},
	);
}

host.it(
	"watch preserves scheduler recovery and completion after a failed dispatch without another dispatch",
	[boardWork({ "one.md": task("one", "approved").replace("fleet: approved", "fleet: approved\ndelivers: report") }), delayedRefresh(true)],
	function* (daemon) {
		yield* daemon.request("daemon.dispatch", { workId: "one" });
		yield* daemon.awaitDelay();
		yield* daemon.releaseDelay();
		const failed = yield* daemon.dispatchOutcome("one");
		expect(failed.status).toBe("failed");
		yield* daemon.stop();
		daemon.removeDelay();
		yield* daemon.start();
		yield* daemon.startScheduler();
		const running = yield* daemon.launched("one");
		yield* daemon.subscribe(["one"]);
		expect(daemon.snapshots()).toMatchObject([[{ stage: "working", workId: "one" }]]);
		yield* daemon.follow("watch", "watch", ["one"]);
		daemon.finishTurn(running, "Recovered findings.");
		const completed = yield* daemon.waitForRecord("one", (record) => record.step === "done");
		expect(completed.report?.sourcePath).toBeDefined();
		const watched = yield* daemon.followerExit("watch");
		yield* daemon.awaitSnapshots(2);
		expect(daemon.snapshots().at(-1)).toMatchObject([{ stage: "done", workId: "one" }]);
		expect(watched).toMatchObject({ code: 0, stderr: "", stdout: expect.stringContaining("one done") });
		expect(watched.stdout).not.toContain("Dispatch failed");
		expect(yield* daemon.request("daemon.dispatch-status", { workId: "one" })).toEqual(failed);
		expect(daemon.providerLaunches()).toHaveLength(1);
	},
);
