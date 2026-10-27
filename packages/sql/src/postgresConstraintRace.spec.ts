import { Deferred, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { hasConstrainedItems } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"a losing insert maps its unique violation after rollback and can read the winner",
	[hasConstrainedItems()],
	function* ({ constrainedItems, sql, transact, waitingOn }) {
		const { items, onSqlError } = constrainedItems();
		const held = yield* Deferred.make<number>();
		const release = yield* Deferred.make<void>();
		const winner = yield* Effect.gen(function* () {
			const row = yield* items.insert({ name: "Shared", quantity: 1 });
			const pids = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
			yield* Deferred.succeed(held, pids[0]?.pid ?? 0);
			yield* Deferred.await(release);
			return row;
		}).pipe(transact({ onSqlError }), Effect.forkChild);
		const pid = yield* Deferred.await(held);
		const loser = yield* Effect.gen(function* () {
			yield* items.insert({ name: "Must roll back", quantity: 2 });
			return yield* items.insert({ name: "Shared", quantity: 3 });
		}).pipe(transact({ onSqlError }), Effect.result, Effect.forkChild);
		yield* eventually(Effect.flatMap(waitingOn(pid), (waiting) => Effect.try(() => expect(waiting).toBe(true))));
		yield* Deferred.succeed(release, undefined);
		const winningRow = yield* Fiber.join(winner);
		const rejected = yield* Fiber.join(loser);
		expect(rejected).toMatchObject({ _tag: "Failure", failure: { _tag: "NameTaken" } });
		const recovered = yield* Effect.fromResult(rejected).pipe(Effect.catchTag("NameTaken", () => items.findMany({ where: { name: "Shared" } })));
		expect(recovered).toEqual([winningRow]);
		expect(yield* items.findMany()).toEqual([winningRow]);
	},
);
