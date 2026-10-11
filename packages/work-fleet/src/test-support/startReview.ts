import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { EngineFixture } from "#test/engine.ts";
import { HEAD, PR } from "#test/githubResult.ts";
import { reportWorker } from "#test/reportWorker.ts";

export const startReview = Effect.fn("Test.startReview")(function* (fixture: EngineFixture) {
	yield* reportWorker(fixture);
	const fleet = yield* Fleet;
	const reviewing = yield* fleet.reconcile("one");
	expect(reviewing.value.stage).toBe("reviewing");
	expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
	return reviewing;
});
