import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import type { MainSnapshot } from "#host/mainSource.ts";
import { FleetPolicy } from "#policy.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { movingMainSource } from "#test/mainSource.ts";
import { parkStalled, stalledTransport } from "#test/parkStalled.ts";
import { postgresTests } from "#test/postgres.ts";
import { answerReport } from "#test/report.ts";

for (const mode of ["scheduler", "dispatch"] as const) {
	postgresTests("live")(`${mode} launches a stalled worker's fresh retry from current main after restart`, () => {
		let now = 100;
		let main: MainSnapshot = { observedAt: 1, revision: "main-0" };
		const provider = engineProvider({ decorateTransport: stalledTransport }, []);
		const source = movingMainSource(() => main);
		return withHost({ "one.md": task("one", "approved") }, {}, (fixture) => {
			const runtime = hostLayer(fixture.host, {
				...fixture.parts,
				main: source,
				policy: Layer.succeed(FleetPolicy)(enginePolicy({ now: () => now })),
				provider: provider.transport,
			});
			return Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* dispatchApproved(fixture.host, "one");
				yield* parkStalled(() => {
					now += 31 * 60_000;
				});
				now += 31 * 60_000;
				const stalled = (yield* fleet.reconcile("one")).value;
				expect(stalled.decision?.code).toBe("session-stalled");
				if (stalled.decision?.published === undefined) {
					return yield* Effect.die("Missing stalled decision");
				}
				main = { observedAt: 2, revision: "main-1" };
				expect(yield* admitApproved(fixture.host)).toEqual([]);
				expect((yield* fleet.get("one")).value.decision).toEqual(stalled.decision);
				const responseId = answerReport(fixture.host.boardDir, stalled.decision.published, "retry");
				const retried = (yield* fleet.resolve("one", stalled.decision.id, responseId)).value;
				expect(retried.stage).toBe("prepared");
				expect(retried.decision).toBeUndefined();
				const launched = yield* Effect.gen(function* () {
					if (mode === "scheduler") {
						expect(yield* admitApproved(fixture.host)).toEqual([]);
						yield* cycle;
					} else {
						yield* dispatchApproved(fixture.host, "one");
					}
					return (yield* (yield* Fleet).reconcile("one")).value;
				}).pipe(Effect.provide(Layer.fresh(runtime)));
				expect(launched.stage).toBe("executing");
				expect(launched.decision).toBeUndefined();
				expect(launched.preparation).toEqual({ ...retried.preparation, baseRevision: main.revision, observedAt: main.observedAt });
				expect(launched.attempts.slice(0, -1)).toEqual(retried.attempts);
				expect(launched.attempts.at(-1)).toMatchObject({ role: "worker", status: "running" });
				expect(launched.attempts.at(-1)?.receipt?.sessionId).not.toBe(stalled.attempts.at(-1)?.receipt?.sessionId);
				expect(provider.launched).toHaveLength(2);
				expect(launched.responses).toEqual(retried.responses);
				expect(launched.history ?? []).toEqual([]);
			}).pipe(Effect.provide(runtime));
		});
	});
}
