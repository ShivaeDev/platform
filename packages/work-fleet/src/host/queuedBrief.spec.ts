import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { FleetPolicy } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

for (const rejectedCall of ["session", "turn"] as const) {
	postgresTests("live")(`host admission refreshes a queued initial ${rejectedCall} after an approved brief edit`, () => {
		let now = 100;
		let reject = true;
		const launch = { model: "initial-model" };
		const source = task("one", "approved", "Original criteria.");
		const provider = engineProvider(
			{
				submissionFailure: (call) =>
					reject && call === rejectedCall
						? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
						: undefined,
			},
			[],
		);
		return withHost({ "one.md": source }, { launch }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* admitApproved(fixture.host);
				yield* dispatchApproved(fixture.host, "one");
				const queued = (yield* fleet.get("one")).value;
				const failed = queued.attempts.at(-1);
				expect(queued.step).toBe("queued");
				expect(queued.launchRetry).toEqual({ rejectedAt: 100, rejections: 1, retryAt: 30_100 });
				expect(failed).toMatchObject({ prompt: source, role: "worker", settings: { model: "initial-model" }, status: "failed" });
				const current = task("one", "approved", "New criteria.").replace(
					"fleet: approved",
					"fleet: approved\nfleet-launch:\n  model: new-task-model",
				);
				fixture.write("one.md", current);
				launch.model = "new-host-model";
				reject = false;
				now = 30_099;
				expect(yield* admitApproved(fixture.host)).toEqual([]);
				expect((yield* fleet.get("one")).value).toEqual(queued);
				yield* cycle;
				expect((yield* fleet.get("one")).value.decision).toBeUndefined();
				expect(provider.launched).toHaveLength(1);
				now = 30_100;
				yield* admitApproved(fixture.host);
				expect((yield* fleet.get("one")).value.decision).toBeUndefined();
				yield* cycle;
				const accepted = (yield* fleet.get("one")).value;
				const attempt = accepted.attempts.at(-1);
				expect(accepted.step).toBe("working");
				expect(accepted.decision).toBeUndefined();
				expect(accepted.boardContext).toBe(current);
				expect(accepted.launchRetry).toBeUndefined();
				expect(accepted.attempts.slice(0, -1)).toEqual(queued.attempts);
				expect(accepted.history ?? []).toEqual(queued.history ?? []);
				expect(attempt).toMatchObject({ prompt: expect.stringContaining(current), settings: failed?.settings, status: "accepted" });
				expect(provider.launched).toHaveLength(rejectedCall === "session" ? 2 : 1);
				expect(provider.settings.filter((call) => call.call === "turn")).toHaveLength(rejectedCall === "turn" ? 2 : 1);
			}).pipe(
				Effect.provide(
					hostLayer(fixture.host, {
						...fixture.parts,
						policy: Layer.succeed(FleetPolicy)(enginePolicy({ launch, now: () => now })),
						provider: provider.transport,
					}),
				),
			),
		);
	});
}
