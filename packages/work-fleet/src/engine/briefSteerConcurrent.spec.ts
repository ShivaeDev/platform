import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

for (const failure of [false, true]) {
	postgresTests("test", "isolated")(`reconciliation during brief steering preserves one delivery and its evidence: failure=${failure}`, () =>
		concurrentSteer(failure),
	);
}

const concurrentSteer = Effect.fnUntraced(function* (failure: boolean) {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	let calls = 0;
	yield* withFleetBoard(
		{
			decorateTransport: (transport) => ({
				...transport,
				steer: (receipt, prompt) =>
					Effect.gen(function* () {
						calls += 1;
						yield* Deferred.succeed(entered, undefined);
						yield* Deferred.await(release);
						if (failure) {
							return yield* new SessionFailure({ message: "Steer failed", reason: "unavailable" });
						}
						yield* transport.steer?.(receipt, prompt) ?? Effect.die("Missing synthetic steer");
					}),
			}),
		},
		(_fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				boardHttpFiles(root).write("one.md", `${source}\nRevised scope.\n`);
				const approving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
				yield* Deferred.await(entered);
				const observed = yield* fleet.reconcile("one");
				yield* Deferred.succeed(release, undefined);
				const approved = yield* Fiber.join(approving);
				expect(approved.version).toBeGreaterThan(observed.version);
				expect(approved.value.step).toBe("working");
				expect(approved.value.attempts[0]?.briefSteers).toEqual([expect.objectContaining(failure ? { error: "Steer failed" } : { steeredAt: 100 })]);
				expect(calls).toBe(1);
			}),
	);
});
