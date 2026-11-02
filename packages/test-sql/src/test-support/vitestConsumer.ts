import { Effect, Option } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { secondClient, setup } from "./postgres.ts";

function transactionState(open: Option.Option<unknown>): "open" | "none" {
	return Option.isSome(open) ? "open" : "none";
}

const itemValues = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return (yield* sql<{ value: string }>`select value from items order by id`).map(({ value }) => value);
});

export const vitestConsumer = storyKit({
	around: withTestTransaction,
	clock: "live",
	*create() {
		const sql = yield* SqlClient.SqlClient;
		const harness = yield* itemValues;
		yield* Effect.acquireRelease(sql`insert into items values (2, 'harness')`, () => Effect.orDie(sql`insert into items values (3, 'finalizer')`));
		return { harness };
	},
	layer: setup().layer,
	name: "database consumer",
	stages: [],
	verbs: (engine, story) => ({
		harnessSaw: () => {
			story.tell("the story reads the items seen during harness setup");
			return engine.harness;
		},
		inIsolatedBlock: <A, E, R>(effect: Effect.Effect<A, E, R>) => {
			story.tell("the story opens an isolated database block");
			return withIsolatedDatabase(effect);
		},
		items: () => {
			story.tell("the story reads its items");
			return itemValues;
		},
		otherConnectionItems: () => {
			story.tell("another connection reads the isolated block’s items");
			return Effect.gen(function* () {
				const database = yield* PostgresTestDatabase;
				const sql = yield* secondClient(database.url);
				return (yield* sql<{ value: string }>`select value from items order by id`).map(({ value }) => value);
			});
		},
		transaction: () => {
			story.tell("the story checks whether its SQL client has a transaction");
			return Effect.flatMap(SqlClient.SqlClient, (sql) => Effect.map(Effect.serviceOption(sql.transactionService), transactionState));
		},
		writeItem: (value: string) => {
			story.tell(`the story writes the item "${value}"`);
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value} where id = 1`);
		},
	}),
});

vitestConsumer.it("writes in its body after the harness wrote", [], function* ({ harnessSaw, items, writeItem }, context) {
	yield* writeItem("body");
	context.task.meta.consumer = { body: yield* items(), harness: harnessSaw(), role: "the first story" };
});

vitestConsumer.it("reads after the first story", [], function* ({ harnessSaw, items }, context) {
	context.task.meta.consumer = { body: yield* items(), harness: harnessSaw(), role: "the next story" };
});

vitestConsumer.it("commits in an isolated block", [], function* ({ inIsolatedBlock, items, otherConnectionItems, transaction, writeItem }, context) {
	const isolated = yield* inIsolatedBlock(
		Effect.gen(function* () {
			const open = yield* transaction();
			const starting = yield* items();
			yield* writeItem("committed");
			return { items: starting, otherConnection: yield* otherConnectionItems(), transaction: open };
		}),
	);
	context.task.meta.consumer = { body: yield* items(), isolated, role: "the isolated story" };
});
