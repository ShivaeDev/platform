import { expect } from "@effect/vitest";
import { WAIT_EXIT } from "#host/wait.ts";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it(
	"the wait process exits distinctly on each terminal state and on timeout",
	[],
	function* (daemon) {
		yield* daemon.store("done", { outcome: { url: "https://example.test/pull/1" }, stage: "done", step: "done" });
		yield* daemon.store("stuck", { decision: { reason: "Independent review rejected the change" }, stage: "waiting", step: "waiting" });
		yield* daemon.transition("gone", "released");
		yield* daemon.store("busy", { blocker: "Worker is running", stage: "working", step: "working" });
		const runs: Array<{ code: number | null; stderr: string; stdout: string }> = [];
		for (const id of ["done", "stuck", "gone", "busy"]) {
			yield* daemon.follow("wait", [id], { timeout: 1 });
			runs.push(yield* daemon.exit());
		}
		expect(runs).toEqual([
			{ code: WAIT_EXIT.completed, stderr: "", stdout: "done done: https://example.test/pull/1" },
			{ code: WAIT_EXIT.waitingDecision, stderr: "", stdout: "stuck waiting (waiting on orchestrator): Independent review rejected the change" },
			{ code: WAIT_EXIT.released, stderr: "", stdout: "gone released" },
			{ code: WAIT_EXIT.timeout, stderr: "", stdout: "busy still working (waiting on orchestrator): Worker is running: wait timed out" },
		]);
	},
	60_000,
);

fleetDaemon.it("wait follows a commit when Fleet first records the work", [], function* (daemon) {
	yield* daemon.follow("wait", ["late"]);
	yield* daemon.awaitSnapshot();
	yield* daemon.transition("late", "released");
	expect(yield* daemon.exit()).toMatchObject({ code: WAIT_EXIT.released, stdout: "late released" });
});
