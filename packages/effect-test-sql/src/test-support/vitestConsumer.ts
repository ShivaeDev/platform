import { Effect, Option } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { secondClient, setup, values } from "./postgres.ts";

const fixture = setup();

declare module "vitest" {
	interface TaskMeta {
		databaseConsumer?: unknown;
	}
}

export const vitestConsumer = storyKit({
	around: withTestTransaction,
	clock: "live",
	*create() {
		const sql = yield* SqlClient.SqlClient;
		const initial = yield* values;
		yield* Effect.acquireRelease(sql`insert into items values (2, 'harness')`, () => Effect.orDie(sql`insert into items values (3, 'finalizer')`));
		return { initial };
	},
	layer: fixture.layer,
	name: "database consumer",
	stages: [],
	verbs: (engine) => ({
		acquiredItems: () => engine.initial,
		counts: () => ({ ...fixture.counts }),
		inClone: withIsolatedDatabase,
		readItems: () => values,
		readOtherConnection: () =>
			Effect.gen(function* () {
				const database = yield* PostgresTestDatabase;
				const sql = yield* secondClient(database.url);
				return yield* sql<{ value: string }>`select value from items order by id`;
			}),
		transactionPresent: () => Effect.flatMap(SqlClient.SqlClient, (sql) => Effect.map(Effect.serviceOption(sql.transactionService), Option.isSome)),
		writeItem: (value: string) => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value} where id = 1`),
	}),
});

vitestConsumer.it("changes an item after harness acquisition", [], function* (test, context) {
	yield* test.writeItem("body");
	context.task.meta.databaseConsumer = { acquisition: test.acquiredItems(), body: yield* test.readItems() };
});

vitestConsumer.it("reads the next test's fixtures", [], function* (test, context) {
	context.task.meta.databaseConsumer = { acquisition: test.acquiredItems(), body: yield* test.readItems(), counts: test.counts() };
});

vitestConsumer.it("commits in an isolated database inside the rollback test", [], function* (test, context) {
	const isolated = yield* test.inClone(
		Effect.gen(function* () {
			const transactionPresent = yield* test.transactionPresent();
			const initial = yield* test.readItems();
			yield* test.writeItem("committed");
			return { initial, transactionPresent, visibleToOtherConnection: yield* test.readOtherConnection() };
		}),
	);
	context.task.meta.databaseConsumer = { body: yield* test.readItems(), counts: test.counts(), isolated };
});
