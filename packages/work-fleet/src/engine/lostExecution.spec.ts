import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

for (const role of ["worker", "repair"] as const) {
	postgresTests("test", "isolated")(`lost ${role} read exhaustion retains ownership without a replacement`, () => {
		let now = 100;
		const failure = new SessionFailure({ code: "session-unavailable", message: "Lost thread acknowledgement", reason: "ambiguous" });
		return withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					reconcile: () => Effect.fail(failure),
					startSession: () => Effect.fail(failure),
				}),
				now: () => now,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					const started = yield* fleet.dispatch("one");
					yield* fixture.replaceRecord({ ...started.value, attempts: started.value.attempts.map((attempt) => ({ ...attempt, role })) });
					for (const delay of [30_000, 60_000, 120_000, 240_000]) {
						now += delay;
						yield* fixture.restart(cycle);
					}
					const parked = (yield* fleet.get("one")).value;
					expect(parked.decision?.reason).toContain("provider read failure after 5 attempts");
					expect(parked.step).toBe("waiting");
					expect(executing(parked)).toBe(true);
					expect(parked.attempts).toHaveLength(1);
					expect(parked.launchRetry).toBeUndefined();
					now += 1_000_000;
					yield* fixture.restart(cycle);
					expect((yield* fleet.get("one")).value.attempts).toEqual(parked.attempts);
					expect(fixture.decisions).toHaveLength(1);
				}),
		);
	});
}
