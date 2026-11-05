import { Context, Effect, Exit, Layer, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PotStorage } from "#test/diary/PotStorage.ts";
import { Pots } from "#test/diary/Pots.ts";
import { Plates } from "#test/diary/plates/service.ts";
import { PotLifecycle } from "#test/diary/pot-lifecycle/service.ts";
import { onPostgres } from "#test/engines.ts";
import { endingOf } from "#test/outcome.ts";
import { uniqueTable } from "#test/writeTables.ts";
import { transact } from "#transact.ts";

const sharedRepositoryEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = uniqueTable("shared_pots");
	const initialized: object[] = [];
	const scope = yield* Scope.fork(yield* Effect.scope);
	const live = Layer.merge(Plates.layer, PotLifecycle.layer).pipe(
		Layer.provideMerge(Pots.layer),
		Layer.provide(Layer.succeed(PotStorage, { initialized, tableName })),
	);
	const context = yield* Layer.buildWithScope(live, scope);
	return {
		initialized,
		lifecycle: Context.get(context, PotLifecycle),
		plates: Context.get(context, Plates),
		pots: Context.get(context, Pots),
		scope,
		sql,
		tableName,
	};
});

export const sharedRepositories = storyKit({
	...onPostgres,
	create: sharedRepositoryEngine,
	name: "two services sharing a PostgreSQL repository",
	stages: ["rows"],
	verbs: ({ initialized, lifecycle, plates, pots, scope, sql, tableName }, story) => ({
		addPortion: (amount: number) => {
			story.tell(`plates adds a portion of ${amount} to pot 1`);
			return plates.addPortion(1, amount);
		},
		closeRepositories: () => {
			story.tell("the application's repository Layer scope closes");
			return Scope.close(scope, Exit.void);
		},
		inTransaction: <A, E, R>(body: Effect.Effect<A, E, R>) => transact(body, { onSqlError: (error) => error }),
		loadPot: () => plates.loadPot(1),
		repositoryBuilds: () => Effect.sync(() => initialized.length),
		repositoryIsShared: () => Effect.sync(() => initialized.length === 1 && initialized[0] === pots),
		settlePot: () => {
			story.tell("the pot lifecycle settles pot 1 by replaying its pending portions");
			return lifecycle.settlePot(1);
		},
		storedPot: () => sql`select amount, pending from ${sql(tableName)} where id = 1`,
		tableExists: () =>
			Effect.map(sql<{ readonly present: boolean }>`select to_regclass(${tableName}) is not null as present`, ([row]) => row?.present),
		transactionEnding: <A, E, R>(body: Effect.Effect<A, E, R>) => endingOf(transact(body, { onSqlError: (error) => error })),
	}),
});

export function potStored() {
	return sharedRepositories.trait("rows", "pot 1 holds 10 settled and 2 pending", ({ pots }) =>
		pots.rows.insertVoid({ amount: 10, id: 1, pending: 2 }),
	);
}
