import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect, it } from "vitest";
import type { Outcome } from "#frame.ts";
import { type Current, change, harness, makeDatabase, on } from "#test/fake-database.ts";

it("settle is idempotent: the first outcome wins and a frame publishes at most once", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published } = harness();
			const database = makeDatabase("main");
			const committed = yield* on(database)(channel.open);
			yield* on(database)(committed.provide(channel.record([change("ada")])));
			yield* committed.settle("committed");
			yield* committed.settle("committed");
			yield* committed.settle("rolledBack");
			expect(published).toEqual([["ada:orders"]]);

			const discarded = yield* on(database)(channel.open);
			yield* on(database)(discarded.provide(channel.record([change("bob")])));
			yield* discarded.settle("rolledBack");
			yield* discarded.settle("committed");
			expect(published).toEqual([["ada:orders"]]);
		}),
	));

it("work that outlives its frame dies instead of dropping changes", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const release = yield* Deferred.make<void>();
			const late = (effect: Effect.Effect<void, never, Current>) =>
				Effect.andThen(write(database, "row", change("ada")), Effect.forkChild(Effect.andThen(Deferred.await(release), on(database)(effect))));
			const recording = yield* late(channel.record([change("bob")])).pipe(inTransaction(database));
			const opening = yield* late(write(database, "late row", change("cyd")).pipe(inTransaction(database))).pipe(inTransaction(database));
			yield* Deferred.succeed(release, undefined);
			for (const straggler of [recording, opening]) {
				const exit = yield* Fiber.await(straggler);
				expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
			}
			expect(published).toEqual([["ada:orders"], ["ada:orders"]]);
			expect(database.committed).toEqual(["row", "row"]);

			const parent = yield* on(database)(channel.open);
			const child = yield* on(database)(parent.provide(channel.open));
			yield* on(database)(child.provide(channel.record([change("dan")])));
			yield* parent.settle("committed");
			const merged = yield* Effect.exit(child.settle("committed"));
			expect(Exit.isFailure(merged) && Cause.hasDies(merged.cause)).toBe(true);
			expect(published).toHaveLength(2);
		}),
	));

it("a Promise-committing driver runs the body outside the fiber and settles from the commit outcome", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published } = harness();
			const database = makeDatabase("main");
			const driver = <X, E>(body: Effect.Effect<X, E, Current>, commits: boolean) =>
				Effect.gen(function* () {
					const frame = yield* channel.open;
					const context = yield* Effect.context<Current>();
					const outcome = yield* Effect.promise(
						(): Promise<Outcome> =>
							Effect.runPromiseExitWith(context)(frame.provide(body)).then((exit) => (commits && Exit.isSuccess(exit) ? "committed" : "rolledBack")),
					);
					yield* frame.settle(outcome);
					return outcome;
				});
			const committed = yield* on(database)(
				driver(
					Effect.gen(function* () {
						yield* channel.record([change("ada")]);
						yield* driver(channel.record([change("bob")]), true);
						yield* driver(channel.record([change("cyd")]), false);
						expect(published).toEqual([]);
					}),
					true,
				),
			);
			expect(committed).toBe("committed");
			expect(published).toEqual([["ada:orders", "bob:orders"]]);

			const failedCommit = yield* on(database)(driver(channel.record([change("dan")]), false));
			expect(failedCommit).toBe("rolledBack");
			expect(published).toEqual([["ada:orders", "bob:orders"]]);
		}),
	));
