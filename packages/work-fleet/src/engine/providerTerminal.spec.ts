import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { SessionObservation } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

function terminalCapacityCase(reviewer: boolean, clears: boolean) {
	let now = 100;
	let reject = true;
	const expectedStage = reviewer ? "completed" : "executing";
	const expectedRole = reviewer ? "reviewer" : "worker";
	function failCapacity(observation: SessionObservation): SessionObservation {
		const isReviewer = observation.output.includes("FLEET_REVIEW:");
		return reject && isReviewer === reviewer
			? { ...observation, capacity: "serverOverloaded", error: "Selected model is at capacity", execution: "failed" }
			: observation;
	}
	return withEngine(
		{
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) => transport.observe(receipt).pipe(Effect.map(failCapacity)),
			}),
			now: () => now,
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				if (reviewer) {
					finishWorkers(fixture);
				}
				for (const delay of [30_000, 60_000, 120_000, 240_000]) {
					yield* cycle;
					const queued = (yield* fleet.get("one")).value;
					expect(queued.launchRetry?.retryAt).toBe(now + delay);
					expect(queued.decision).toBeUndefined();
					now += delay;
					if (clears) {
						reject = false;
						break;
					}
					yield* fixture.restart(cycle);
				}
				yield* fixture.restart(cycle);
				if (clears) {
					expect((yield* fleet.get("one")).value.launchRetry).toBeUndefined();
					expect((yield* fleet.get("one")).value.stage).toBe(expectedStage);
					expect(fixture.decisions).toHaveLength(0);
				} else {
					const parked = (yield* fleet.get("one")).value;
					expect(parked.stage).toBe("needs-human");
					expect(parked.decision?.reason).toContain("Selected model is at capacity; provider failure after 5 attempts");
					expect(parked.attempts.filter((attempt) => attempt.role === expectedRole)).toHaveLength(5);
				}
			}),
	);
}

for (const reviewer of [false, true]) {
	for (const clears of [false, true]) {
		test(`terminal capacity retries remain bounded: reviewer=${reviewer}, clears=${clears}`, () => terminalCapacityCase(reviewer, clears));
	}
}
