import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

describe("renewal retains unresolved decision publication", () => {
	const test = postgresTests("test");
	test("a lost publication response recovers the original context before archival", () =>
		withEngine({ noChange: true, publishFailure: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				fixture.editWork("one", "board-one-next");
				expect((yield* fleet.reconcile("one")).value.decisionPublished).toBe(false);
				fixture.approveWork("one", "board-one-next");

				const renewed = yield* prepareWork("one");
				expect(renewed.value.stage).toBe("prepared");
				expect(renewed.value.boardRevision).toBe("board-one-next");
				expect(renewed.value.history?.[0]?.decision?.published?.workRevision).toBe("board-one");
				expect(renewed.value.history?.[0]?.decisionAcknowledged).toBe(true);
				expect(fixture.launched).toHaveLength(1);
			}),
		));
});
