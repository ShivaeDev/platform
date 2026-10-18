import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { change } from "#test/fakeDatabase.ts";
import { changes, hasNestedFrames } from "#test/kit.ts";

changes.it("settle is idempotent: the first outcome wins and a frame publishes at most once", [], function* ({ published, record, open }) {
	const committed = yield* open();
	yield* committed.provide(record([change("ada")]));
	yield* committed.settle("committed");
	yield* committed.settle("committed");
	yield* committed.settle("rolledBack");
	expect(published).toEqual([["ada:orders"]]);

	const discarded = yield* open();
	yield* discarded.provide(record([change("bob")]));
	yield* discarded.settle("rolledBack");
	yield* discarded.settle("committed");
	expect(published).toEqual([["ada:orders"]]);
});

changes.it("work that outlives its frame dies instead of dropping changes", [], function* ({ published, inTransaction, write, database, record }) {
	const release = yield* Deferred.make<void>();
	function late<E>(effect: Effect.Effect<void, E>) {
		return Effect.andThen(write(database, "row", change("ada")), Effect.forkChild(Effect.andThen(Deferred.await(release), effect)));
	}
	const recording = yield* late(record([change("bob")])).pipe(inTransaction(database));
	const opening = yield* late(write(database, "late row", change("cyd")).pipe(inTransaction(database))).pipe(inTransaction(database));
	yield* Deferred.succeed(release, undefined);
	for (const straggler of [recording, opening]) {
		const exit = yield* Fiber.await(straggler);
		expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
	}
	expect(published).toEqual([["ada:orders"], ["ada:orders"]]);
	expect(database.committed).toEqual(["row", "row"]);
});

changes.it(
	"a Promise-committing driver runs the body outside the fiber and settles from the commit outcome",
	[],
	function* ({ published, record, driver }) {
		const committed = yield* driver(
			Effect.gen(function* () {
				yield* record([change("ada")]);
				yield* driver(record([change("bob")]), true);
				yield* driver(record([change("cyd")]), false);
				expect(published).toEqual([]);
			}),
			true,
		);
		expect(committed).toBe("committed");
		expect(published).toEqual([["ada:orders", "bob:orders"]]);

		const failedCommit = yield* driver(record([change("dan")]), false);
		expect(failedCommit).toBe("rolledBack");
		expect(published).toEqual([["ada:orders", "bob:orders"]]);
	},
);

changes.it("a child cannot merge into a parent that has settled", [hasNestedFrames()], function* ({ frame, record, published }) {
	const parent = frame("parent");
	const child = frame("child");
	yield* child.provide(record([change("dan")]));
	yield* parent.settle("committed");
	const merged = yield* Effect.exit(child.settle("committed"));
	expect(Exit.isFailure(merged) && Cause.hasDies(merged.cause)).toBe(true);
	expect(published).toEqual([]);
});
