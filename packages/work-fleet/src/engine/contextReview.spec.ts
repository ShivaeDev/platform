import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test", "isolated");

for (const timing of ["between passes", "while the reviewer finishes"] as const) {
	test(`approved criteria edited ${timing} continue without accepting the old review`, function* () {
		const observing = yield* Deferred.make<void>();
		const resume = yield* Deferred.make<void>();
		const betweenPasses = timing === "between passes";
		yield* withFleetBoard(
			{
				reviewGate: betweenPasses ? Effect.void : Deferred.succeed(observing, undefined).pipe(Effect.andThen(Deferred.await(resume))),
				reviewRunning: betweenPasses,
			},
			(fixture, root, source) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					const worker = yield* fleet.dispatch("one");
					finishWorkers(fixture);
					if (betweenPasses) {
						expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
					}
					const reconciliation = betweenPasses ? undefined : yield* fleet.reconcile("one").pipe(Effect.forkChild);
					if (!betweenPasses) {
						yield* Deferred.await(observing);
					}
					const current = `${source}\nUpdated acceptance criteria.\n`;
					boardHttpFiles(root).write("one.md", current);
					finishWorkers(fixture);
					yield* Deferred.succeed(resume, undefined);
					const continued = reconciliation === undefined ? yield* fleet.reconcile("one") : yield* Fiber.join(reconciliation);
					expect(continued.value.step).toBe("reviewing");
					expect(continued.value.decision).toBeUndefined();
					expect(continued.value.review).toBeUndefined();
					expect(continued.value.checks).toBeUndefined();
					expect(continued.value.outcome).toBeUndefined();
					expect(continued.value.boardContext).toBe(current);
					expect(continued.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
					expect(continued.value.attentionOwner).toBeUndefined();
					expect(fixture.launched).toHaveLength(2);
				}),
		);
	});
}
