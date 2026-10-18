import { Cause, Effect, Exit, Ref } from "effect";
import { expect } from "vitest";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { beforeCommit, postgres, sinkReadsCommittedRows } from "#test/prismaTraits.ts";

prisma.it.runIf(postgresEnabled)(
	"beforeCommit sees the body's recorded changes while its PostgreSQL writes are still uncommitted",
	[beforeCommit(() => Effect.void), sinkReadsCommittedRows(), postgres()],
	function* ({ database: { changes, checked, order, orders, published, seen } }) {
		const result = yield* Effect.gen(function* () {
			yield* order("o1", "ada");
			yield* order("o2", "bob");
			yield* order("o3", "ada");
			expect(checked).toEqual([]);
			expect(published).toEqual([]);
			return "saved";
		}).pipe(changes.transaction);
		expect(result).toBe("saved");
		expect(checked).toEqual([{ changes: ["ada:orders", "bob:orders"], committed: [] }]);
		expect(yield* orders()).toEqual(["o1", "o2", "o3"]);
		expect(published).toEqual([["ada:orders", "bob:orders"]]);
		expect(seen).toEqual([["o1", "o2", "o3"]]);
	},
);

const rejected = new Error("The beforeCommit invariant rejected the write");

prisma.it.runIf(postgresEnabled)(
	"a beforeCommit failure rolls back the PostgreSQL write and publishes nothing",
	[beforeCommit(() => Effect.die(rejected)), postgres()],
	function* ({ database: { changes, checked, observe, observations, order, orders, published } }) {
		const exit = yield* Effect.exit(order("o1").pipe(changes.transaction, observe));
		expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(rejected);
		expect(checked).toEqual([{ changes: ["ada:orders"], committed: [] }]);
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
		expect(observations.map(({ _tag }) => _tag)).toEqual(["Recorded", "Discarded"]);
	},
);

for (const outerClient of [false, true]) {
	prisma.it.runIf(postgresEnabled)(
		`a hook reads uncommitted body rows and its own write rolls back on failure (${outerClient ? "explicit" : "default"} outer client)`,
		[postgres()],
		function* ({ database: { changes, client, observe, observations, order, orders, published } }) {
			const read = yield* Ref.make<string | undefined>(undefined);
			function hook() {
				return Effect.gen(function* () {
					const row = yield* changes.use((db) => db.order.findUnique({ where: { id: "body" } }));
					yield* Ref.set(read, row?.id);
					yield* order("hook", "bob");
					return yield* Effect.die(rejected);
				}).pipe(Effect.orDie);
			}
			const transaction = order("body").pipe(changes.transaction, Effect.provideService(changes.channel.BeforeCommit, hook));
			const exit = yield* Effect.exit((outerClient ? Effect.provideService(transaction, changes.Client, client) : transaction).pipe(observe));
			expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(rejected);
			expect(yield* orders()).toEqual([]);
			expect(yield* Ref.get(read)).toBe("body");
			expect(published).toEqual([]);
			expect(observations.map(({ _tag }) => _tag)).toEqual(["Recorded", "Recorded", "Discarded"]);
			expect(observations.at(-1)).toEqual({
				_tag: "Discarded",
				changes: [
					{ domain: "orders", subject: "ada" },
					{ domain: "orders", subject: "bob" },
				],
			});
		},
	);
}
