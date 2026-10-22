import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { FleetPolicy } from "#policy.ts";
import { withWorkerGuidance } from "#prompt/worker.ts";
import { SessionFailure } from "#session/schema.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

for (const rejectedCall of ["session", "turn"] as const) {
	postgresTests("live")(`explicit approval during backoff refreshes criteria after initial ${rejectedCall} rejection`, () => {
		let now = 100;
		let reject = true;
		const workerGuidance = "Preserve the requested behavior.";
		const policy = enginePolicy({ launch: { model: "queued-model" }, now: () => now, workerGuidance });
		const provider = engineProvider(
			{
				submissionFailure: (call) =>
					reject && call === rejectedCall
						? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
						: undefined,
			},
			[],
		);
		const source = task("one", "approved", "Original criteria.");
		return withHost({ "one.md": source }, {}, (fixture) => {
			const parts = { ...fixture.parts, policy: Layer.succeed(FleetPolicy)(policy), provider: provider.transport };
			const runtime = hostLayer(fixture.host, parts);
			return Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* dispatchApproved(fixture.host, "one");
				const queued = (yield* fleet.get("one")).value;
				const failed = queued.attempts.at(-1);
				const retry = queued.launchRetry;
				if (retry === undefined) {
					return yield* Effect.die("Missing pending retry");
				}
				expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
				expect(failed?.prompt).toBe(withWorkerGuidance(source, workerGuidance));
				const current = task("one", "approved", "New criteria.");
				fixture.write("one.md", current);
				reject = false;
				now = 30_099;
				const approved = yield* dispatchApproved(fixture.host, "one");
				expect(approved.value.boardContext).toBe(current);
				expect(approved.value.boardRevision).not.toBe(queued.boardRevision);
				expect(approved.value.prompt).toBe(current);
				expect(approved.value.launchRetry).toMatchObject(retry);
				expect(approved.value.attempts).toEqual(queued.attempts);
				expect(provider.launched).toHaveLength(1);
				yield* cycle;
				expect((yield* fleet.get("one")).value.attempts).toEqual(queued.attempts);
				now = 30_100;
				const accepted = yield* Effect.gen(function* () {
					yield* cycle;
					return (yield* (yield* Fleet).get("one")).value;
				}).pipe(Effect.provide(Layer.fresh(runtime)));
				expect(accepted.step).toBe("working");
				expect(accepted.attempts[0]).toEqual(failed);
				expect(accepted.attempts.at(-1)).toMatchObject({ prompt: withWorkerGuidance(current, workerGuidance), settings: failed?.settings });
				expect(provider.observations.get(accepted.attempts.at(-1)?.receipt?.turnId ?? "")?.output).toBe(withWorkerGuidance(current, workerGuidance));
				expect(accepted.history ?? []).toEqual([]);
				if (rejectedCall === "turn") {
					expect(accepted.attempts.at(-1)?.receipt?.sessionId).toBe(failed?.sessionId);
					expect(provider.launched).toHaveLength(1);
				} else {
					expect(provider.launched).toHaveLength(2);
				}
				expect(provider.archived).toEqual([]);
			}).pipe(Effect.provide(runtime));
		});
	});
}
