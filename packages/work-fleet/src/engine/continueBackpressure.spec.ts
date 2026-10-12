import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

describe("continuation launch backpressure", () => {
	const test = postgresTests("test");
	for (const checksFailure of [false, true]) {
		test(`a rejected continuation from ${checksFailure ? "needs-human" : "completed"} retries its saved message on the same thread`, () => {
			let now = 100;
			let reject = false;
			const launch = { model: "initial-model" };
			return withEngine(
				{
					checksFailure,
					launch,
					now: () => now,
					resultQuery: (_board, observation) => Effect.succeed({ evidence: [observation.output], head: "current-main", kind: "no-change" }),
					submissionFailure: () => (reject ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined),
				},
				(fixture) =>
					Effect.gen(function* () {
						yield* prepareWork("one");
						const fleet = yield* Fleet;
						yield* fleet.dispatch("one");
						finishWorkers(fixture);
						const stopped = (yield* fleet.reconcile("one")).value;
						expect(stopped.stage).toBe(checksFailure ? "needs-human" : "completed");
						const sessionId = stopped.attempts[0]?.receipt?.sessionId;
						reject = true;
						const queued = (yield* fleet.continue("one", "Check another case")).value;
						expect(queued.attentionOwner).toBe("automation");
						expect(queued.stage).toBe("repairing");
						expect(queued.launchRetry?.retryAt).toBe(30_100);
						expect(queued.history).toHaveLength(1);
						const calls = fixture.settings.length;
						reject = false;
						launch.model = "new-host-model";
						now = 30_099;
						yield* fixture.restart(cycle);
						expect(fixture.settings).toHaveLength(calls);
						now = 30_100;
						yield* fixture.restart(cycle);
						const accepted = (yield* fleet.get("one")).value;
						expect(accepted.stage).toBe("executing");
						expect(accepted.launchRetry).toBeUndefined();
						expect(accepted.attentionOwner).toBeUndefined();
						expect(accepted.attempts.at(-1)).toMatchObject({
							prompt: "Check another case",
							receipt: { sessionId },
							role: "repair",
							settings: { model: "initial-model" },
						});
						expect(accepted.history).toHaveLength(1);
						expect(fixture.launched).toHaveLength(2);
						finishWorkers(fixture);
						expect((yield* fleet.reconcile("one")).value).toMatchObject({ outcome: { evidence: ["Check another case"] }, stage: "completed" });
					}),
			);
		});
	}
});
