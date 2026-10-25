import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { queuedSubmission } from "#test/hostScenarioTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

const source = task("one", "approved", "Original criteria.");
for (const rejectedCall of ["session", "turn"] as const) {
	host.it(
		`host admission refreshes a queued initial ${rejectedCall} after an approved brief edit`,
		[boardWork({ "one.md": source }, { launch: { model: "initial-model" } }), queuedSubmission(rejectedCall)],
		function* (daemon) {
			yield* daemon.admit();
			yield* daemon.approve("one");
			const queued = yield* daemon.get("one");
			const failed = queued.attempts.at(-1);
			expect(queued.step).toBe("queued");
			expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
			expect(failed).toMatchObject({ prompt: source, role: "worker", settings: { model: "initial-model" }, status: "failed" });
			const current = task("one", "approved", "New criteria.").replace("fleet: approved", "fleet: approved\nfleet-launch:\n  model: new-task-model");
			daemon.writeBoard("one.md", current);
			daemon.hostModel("new-host-model");
			daemon.acceptSubmissions();
			daemon.advanceTime(29_999);
			expect(yield* daemon.admit()).toEqual([]);
			expect(yield* daemon.get("one")).toEqual(queued);
			yield* daemon.schedule();
			expect((yield* daemon.get("one")).decision).toBeUndefined();
			expect(daemon.providerLaunches()).toEqual([failed?.operationId]);
			daemon.advanceTime(1);
			yield* daemon.admit();
			expect((yield* daemon.get("one")).decision).toBeUndefined();
			yield* daemon.schedule();
			const accepted = yield* daemon.get("one");
			const attempt = accepted.attempts.at(-1);
			expect(accepted.step).toBe("working");
			expect(accepted.decision).toBeUndefined();
			expect(accepted.boardContext).toBe(current);
			expect(accepted.launchRetry).toBeUndefined();
			expect(accepted.attempts.slice(0, -1)).toEqual(queued.attempts);
			expect(accepted.history ?? []).toEqual(queued.history ?? []);
			expect(attempt).toMatchObject({ prompt: expect.stringContaining(current), settings: failed?.settings, status: "accepted" });
			expect(daemon.providerLaunches()).toEqual(rejectedCall === "session" ? [failed?.operationId, attempt?.operationId] : [failed?.operationId]);
			expect(
				daemon
					.providerCalls()
					.filter((call) => call.call === "turn")
					.map(({ operationId }) => operationId),
			).toEqual(rejectedCall === "turn" ? [failed?.operationId, attempt?.operationId] : [attempt?.operationId]);
		},
	);
}
