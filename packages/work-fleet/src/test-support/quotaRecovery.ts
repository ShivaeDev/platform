import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { admit } from "#admit.ts";
import { failureCode } from "#engine/failureCode.ts";
import { failureContext, withFailureContext } from "#engine/failureContext.ts";
import { Fleet } from "#fleet.ts";
import { boardWork } from "#test/boardWork.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { enginePolicy } from "#test/enginePolicy.ts";

export const quotaRecovery = Effect.fn("Test.quotaRecovery")(function* () {
	const work = boardWork("one", { one: "board-one" });
	const denied = yield* admit(work, [], enginePolicy({ quota: 0 }), () => Effect.succeed(work)).pipe(Effect.flip);
	expect(failureCode(denied)).toBe("provider-quota-unavailable");
	const reworded = withFailureContext(
		new Forbidden({ message: "The provider budget needs to refresh before another operation can start." }),
		failureContext(denied),
	);
	let blocked = false;
	return yield* withEngine(
		{ noChange: true, refreshQuota: () => (blocked ? Effect.fail(reworded) : Effect.succeed(enginePolicy({}).quota)) },
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				const worker = (yield* fleet.dispatch("one")).value.attempts[0]?.receipt;
				finishWorkers(fixture);
				blocked = true;
				const waiting = (yield* fleet.reconcile("one")).value;
				expect(waiting).toMatchObject({ attentionOwner: "automation", blocker: reworded.message, stage: "reviewing" });
				expect(waiting.decision).toBeUndefined();
				expect(waiting.attempts).toHaveLength(1);
				const resumed = yield* fixture.restart(Fleet.pipe(Effect.flatMap((current) => current.reconcile("one"))));
				expect(resumed.value).toEqual(waiting);
				blocked = false;
				const completed = yield* fixture.restart(Fleet.pipe(Effect.flatMap((current) => current.reconcile("one"))));
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.attempts[0]?.receipt).toEqual(worker);
				expect(completed.value.attempts).toHaveLength(2);
				expect(fixture.decisions).toEqual([]);
			}),
	);
});
