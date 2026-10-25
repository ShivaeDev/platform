import { expect } from "@effect/vitest";
import { withWorkerGuidance } from "#prompt/worker.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { queuedHostLaunch } from "#test/queuedHostLaunch.ts";

const WORKER_GUIDANCE = "Preserve the requested behavior.";
const source = task("one", "approved", "Original criteria.");
for (const rejectedCall of ["session", "turn"] as const) {
	host.it(
		`explicit approval during backoff refreshes criteria after initial ${rejectedCall} rejection`,
		[boardWork({ "one.md": source }), queuedHostLaunch(rejectedCall, WORKER_GUIDANCE)],
		function* (daemon) {
			yield* daemon.approve("one");
			const queued = yield* daemon.get("one");
			const failed = queued.attempts.at(-1);
			const retry = queued.launchRetry;
			if (retry === undefined) {
				throw new Error("Missing pending retry");
			}
			expect(retry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
			expect(failed?.prompt).toBe(withWorkerGuidance(source, WORKER_GUIDANCE));
			const current = task("one", "approved", "New criteria.");
			daemon.writeBoard("one.md", current);
			daemon.acceptQueuedLaunches();
			daemon.advanceLaunchTime(30_099);
			const { value: approved } = yield* daemon.approve("one");
			expect(approved.boardContext).toBe(current);
			expect(approved.boardRevision).not.toBe(queued.boardRevision);
			expect(approved.prompt).toBe(current);
			expect(approved.launchRetry).toMatchObject(retry);
			expect(approved.attempts).toEqual(queued.attempts);
			expect(daemon.queuedProvider().launched).toEqual([failed?.operationId]);
			yield* daemon.schedule();
			expect((yield* daemon.get("one")).attempts).toEqual(queued.attempts);
			daemon.advanceLaunchTime(30_100);
			yield* daemon.stop();
			yield* daemon.start();
			yield* daemon.schedule();
			const accepted = yield* daemon.get("one");
			expect(accepted.step).toBe("working");
			expect(accepted.attempts[0]).toEqual(failed);
			expect(accepted.attempts.at(-1)).toMatchObject({ prompt: withWorkerGuidance(current, WORKER_GUIDANCE), settings: failed?.settings });
			expect(daemon.queuedProvider().observations.get(accepted.attempts.at(-1)?.receipt?.turnId ?? "")?.output).toBe(
				withWorkerGuidance(current, WORKER_GUIDANCE),
			);
			expect(accepted.history ?? []).toEqual([]);
			if (rejectedCall === "turn") {
				expect(accepted.attempts.at(-1)?.receipt?.sessionId).toBe(failed?.sessionId);
				expect(daemon.queuedProvider().launched).toEqual([failed?.operationId]);
			} else {
				expect(daemon.queuedProvider().launched).toEqual(accepted.attempts.map(({ operationId }) => operationId));
			}
			expect(daemon.queuedProvider().archived).toEqual([]);
		},
	);
}
