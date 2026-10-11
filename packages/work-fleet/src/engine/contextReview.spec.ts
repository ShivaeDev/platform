import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const timing of ["between passes", "while the reviewer finishes"] as const) {
	test(`approved criteria edited ${timing} discard the old review and continue the worker`, function* () {
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
						expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
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
					expect(continued.value.stage).toBe("executing");
					expect(continued.value.review).toBeUndefined();
					expect(continued.value.checks).toBeUndefined();
					expect(continued.value.outcome).toBeUndefined();
					expect(continued.value.boardContext).toBe(current);
					expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(worker.value.attempts[0]?.receipt?.sessionId);
					expect(continued.value.attempts.at(-1)?.prompt).toContain(current);
					expect(continued.value.decision).toBeUndefined();
					expect(fixture.launched).toHaveLength(2);
				}),
		);
	});
}

test("an approved brief edit while waiting for a merge resumes the worker and supersedes the old merge question", () =>
	withFleetBoard({ denyDelivery: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const waiting = yield* fleet.reconcile("one");
			expect(waiting.value.stage).toBe("needs-human");
			expect(waiting.value.review?.verdict).toBe("approved");
			const published = waiting.value.decision?.published;
			const current = `${source}\nUpdated acceptance criteria.\n`;
			boardHttpFiles(root).write("one.md", current);
			const continued = yield* fleet.reconcile("one");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.review).toBeUndefined();
			expect(continued.value.checks).toBeUndefined();
			expect(continued.value.attempts.at(-1)?.prompt).toContain(current);
			expect(continued.value.result).toEqual(waiting.value.result);
			const acknowledged = yield* fleet.reconcile("one");
			expect(acknowledged.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published }]);
		}),
	));
