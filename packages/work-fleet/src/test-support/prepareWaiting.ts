import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { EngineFixture } from "#test/engine.ts";
import { reportWorker } from "#test/reportWorker.ts";
import { askWorker } from "#test/workerQuestion.ts";

export const prepareWaiting = Effect.fnUntraced(function* (fixture: EngineFixture, scenario: "worker question" | "failing check" | "changed head") {
	yield* reportWorker(fixture);
	const fleet = yield* Fleet;
	let waiting = yield* fleet.reconcile("one");
	if (scenario === "worker question") {
		const decisionId = waiting.value.decision?.id ?? "missing";
		yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
		yield* fleet.reconcile("one");
		waiting = (yield* askWorker(fixture)).stopped;
	}
	if (scenario === "failing check") {
		expect(waiting.value.review?.verdict).toBe("approved");
		expect(waiting.value.checks?.passed).toBe(false);
	}

	return waiting;
});
