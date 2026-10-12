import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const GUIDANCE = "Follow synthetic repository conventions.\nVerify changes locally.";

describe("worker guidance through PostgreSQL", () => {
	const test = postgresTests("test");
	for (const workerGuidance of [undefined, GUIDANCE]) {
		test(`first turns, repairs and manual continuations ${workerGuidance === undefined ? "omit" : "include"} guidance`, () =>
			withEngine({ checkRepair: true, checksFailure: true, repairs: true, ...(workerGuidance === undefined ? {} : { workerGuidance }) }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					const first = yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const reviewRepair = yield* fleet.reconcile("one");
					finishWorkers(fixture);
					const checkRepair = yield* fleet.reconcile("one");
					finishWorkers(fixture);
					expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
					const manual = yield* fleet.continue("one", "Check another case");
					for (const [record, role] of [
						[first, "worker"],
						[reviewRepair, "repair"],
						[checkRepair, "repair"],
						[manual, "repair"],
					] as const) {
						const attempt = record.value.attempts.at(-1);
						expect(attempt?.role).toBe(role);
						expect(fixture.observations.get(attempt?.receipt?.turnId ?? "missing")?.output).toBe(attempt?.prompt);
						if (workerGuidance === undefined) {
							expect(attempt?.prompt).not.toContain("Repository worker guidance:");
							expect(attempt?.prompt).not.toContain(GUIDANCE);
						} else {
							expect(attempt?.prompt).toContain(`Repository worker guidance:\n${GUIDANCE}`);
						}
					}
					expect(fixture.starts.filter((start) => start.access === "read-only").every((start) => !start.prompt.includes(GUIDANCE))).toBe(true);
				}),
			));
	}
	test("a capacity retry preserves the guided prompt once across restart", () => {
		let reject = true;
		let now = 100;
		return withEngine(
			{
				now: () => now,
				submissionFailure: () => (reject ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined),
				workerGuidance: GUIDANCE,
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					const queued = yield* fleet.dispatch("one");
					expect(queued.value.launchRetry).toBeDefined();
					reject = false;
					now = 30_100;
					yield* fixture.restart(cycle);
					const prompt = (yield* fleet.get("one")).value.attempts.at(-1)?.prompt;
					expect(prompt).toBe(queued.value.attempts[0]?.prompt);
					expect(prompt?.split(GUIDANCE)).toHaveLength(2);
					expect(fixture.starts.at(-1)?.prompt).toBe(prompt);
				}),
		);
	});
});
