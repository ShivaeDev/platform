import { expect } from "@effect/vitest";
import { stalledWorker } from "#test/hostScenarioTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const mode of ["scheduler", "dispatch"] as const) {
	host.it(
		`${mode} launches a stalled worker's fresh retry from current main after restart`,
		[approvedWork(["one"]), stalledWorker],
		function* (daemon) {
			yield* daemon.approve("one");
			yield* daemon.reconcile("one");
			for (let step = 0; step < 3; step += 1) {
				daemon.advanceTime(31 * 60_000);
				yield* daemon.reconcile("one");
			}
			daemon.advanceTime(31 * 60_000);
			const stalled = yield* daemon.reconcile("one");
			expect(stalled.decision?.code).toBe("session-stalled");
			if (stalled.decision?.published === undefined) {
				throw new Error("Missing stalled decision");
			}
			daemon.moveMain({ observedAt: 2, revision: "main-1" });
			expect(yield* daemon.admit()).toEqual([]);
			expect((yield* daemon.get("one")).decision).toEqual(stalled.decision);
			const responseId = daemon.answerReport(stalled.decision.published, "retry");
			const retried = yield* daemon.resolve("one", stalled.decision.id, responseId);
			expect(retried.step).toBe("queued");
			expect(retried.decision).toBeUndefined();
			yield* daemon.stop();
			yield* daemon.start();
			if (mode === "scheduler") {
				expect(yield* daemon.admit()).toEqual([]);
				yield* daemon.schedule();
			} else {
				yield* daemon.approve("one");
			}
			const launched = yield* daemon.reconcile("one");
			expect(launched.step).toBe("working");
			expect(launched.decision).toBeUndefined();
			expect(launched.preparation).toEqual({ ...retried.preparation, baseRevision: "main-1", observedAt: 2 });
			expect(launched.attempts.slice(0, -1)).toEqual(retried.attempts);
			expect(launched.attempts.at(-1)).toMatchObject({ role: "worker", status: "running" });
			expect(launched.attempts.at(-1)?.receipt?.sessionId).not.toBe(stalled.attempts.at(-1)?.receipt?.sessionId);
			expect(daemon.providerLaunches()).toHaveLength(2);
			expect(launched.responses).toEqual(retried.responses);
			expect(launched.history ?? []).toEqual([]);
		},
	);
}
