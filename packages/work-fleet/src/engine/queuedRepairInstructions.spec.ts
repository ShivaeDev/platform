import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");
const GUIDANCE = "Preserve the loading indicator while making the requested repair.";

for (const kind of ["review", "checks"] as const) {
	test(`queued guidance preserves ${kind} repair instructions through restart and worker launch`, () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const ready = yield* fleet.reconcile("one");

				const repairPrompt = kind === "review" ? "Fix the missing empty state found in review." : "Fix the failing database check.";
				yield* fixture.replaceRecord(repairRecord(ready.value, kind, repairPrompt));
				yield* fleet.queueAnswer("one", GUIDANCE);
				const next = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
				const attempt = next.value.attempts.at(-1);
				if (attempt?.receipt === undefined) {
					return yield* Effect.die("Expected the next repair receipt");
				}
				expect(attempt.role).toBe("repair");
				expect(attempt.prompt).toBe(`${repairPrompt}\n\n${GUIDANCE}`);
				expect(attempt.receipt.sessionId).toBe(ready.value.attempts[0]?.receipt?.sessionId);
				expect(fixture.observations.get(attempt.receipt.turnId)?.output).toBe(attempt.prompt);
				expect(next.value.pendingAnswers).toBeUndefined();
				if (kind === "checks") {
					expect(attempt.checkFailures).toEqual(["database"]);
				}
			}),
		));
}

function repairRecord(record: FleetRecord, kind: "review" | "checks", repairPrompt: string): FleetRecord {
	const { review, checks } = record;
	if (review === undefined || checks === undefined) {
		throw new Error("Expected done review and checks");
	}
	return {
		...record,
		checks: kind === "checks" ? { ...checks, failedChecks: ["database"], passed: false, repairPrompt } : undefined,
		decision: undefined,
		review: kind === "review" ? { ...review, findings: [repairPrompt], repairPrompt, verdict: "changes" } : review,
		step: "repairing",
	};
}
