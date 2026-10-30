import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { mapSqlError } from "#mapSqlError.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import { InvalidQuantity, Item, NameTaken, NameTooLong, ParentMissing, StorageUnavailable } from "./constrainedItemModels.ts";
import { onPostgres } from "./engines.ts";
import { endingOf, failureOf } from "./outcome.ts";
import { ownTable, readEndings, recorded, records, uniqueTable } from "./writeTables.ts";

export interface ItemInput {
	readonly name: string;
	readonly parentId?: number;
	readonly quantity: number;
}

export type RawStatement = "a negative quantity" | "a missing quantity" | "an unknown column";

const constraintEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("items");
	const names = {
		check: `${table}_quantity_check`,
		foreign: `${table}_parent_fkey`,
		length: `${table}_name_${"ä".repeat(12)}_length_check`,
		unique: `${table}_name_key`,
	};
	yield* ownTable(
		sql,
		table,
		sql`id integer generated always as identity primary key, name text not null,
			"parentId" integer constraint ${sql(names.foreign)} references ${sql(table)} (id),
			quantity integer not null constraint ${sql(names.check)} check (quantity >= 0),
			constraint ${sql(names.unique)} unique (name),
			constraint ${sql(names.length)} check (length(name) <= 40)`,
	);
	return {
		items: yield* makeRepository(Item, { idColumn: "id", spanPrefix: "ConstrainedItem", tableName: table }),
		onSqlError: mapSqlError({
			constraints: {
				[names.check]: () => new InvalidQuantity(),
				[names.foreign]: () => new ParentMissing(),
				[names.length]: () => new NameTooLong(),
				[names.unique]: () => new NameTaken(),
			},
			fallback: () => new StorageUnavailable(),
		}),
		records: records(),
		sql,
		table,
	};
});

type ConstraintEngine = Effect.Success<ReturnType<typeof constraintEngine>>;

function described(items: readonly ItemInput[]) {
	return items
		.map(({ name, parentId, quantity }) => `${name} with quantity ${quantity}${parentId === undefined ? "" : ` under parent ${parentId}`}`)
		.join(", then ");
}

function constraintVerbs({ items, onSqlError, records: log, sql, table }: ConstraintEngine, tell: (line: string) => void) {
	function insertAll(inputs: readonly ItemInput[]) {
		return transact(
			Effect.forEach(inputs, (input) => items.insertVoid(input), { discard: true }),
			{ onSqlError },
		);
	}
	const statements: Record<RawStatement, () => Effect.Effect<unknown, SqlError>> = {
		"a missing quantity": () => sql`insert into ${sql(table)} (name) values ('Missing quantity')`,
		"a negative quantity": () => sql`insert into ${sql(table)} (name, quantity) values ('Invalid', -1)`,
		"an unknown column": () => sql`select nonexistent_column from ${sql(table)}`,
	};
	return {
		endings: () => readEndings(log),
		insertItems: (inputs: readonly ItemInput[]) =>
			Effect.suspend(() => {
				tell(`a transaction that maps named constraints inserts ${described(inputs)}`);
				return recorded(log, endingOf(insertAll(inputs)));
			}),
		insertItemsWhileNameLocked: (name: string, inputs: readonly ItemInput[]) =>
			Effect.gen(function* () {
				tell(`a transaction inserts ${name} and holds it uncommitted while another transaction inserts ${described(inputs)}, then commits`);
				const [loser] = yield* raceWithLock({ effects: [insertAll(inputs)], lock: items.insert({ name, quantity: 1 }), release: "commit" });
				log.endings.push(
					loser === undefined
						? "never ran"
						: Result.match(loser, { onFailure: (error) => `failed with ${failureOf(error)}`, onSuccess: () => "succeeded" }),
				);
			}),
		runMapped: (statement: RawStatement) =>
			Effect.suspend(() => {
				tell(`a raw statement with ${statement} maps its SQL failure through the named constraints`);
				return recorded(log, endingOf(Effect.mapError(statements[statement](), onSqlError)));
			}),
		storedItems: () =>
			Effect.map(items.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["name", "quantity"] }), (rows) =>
				rows.map((row) => ({ ...row })),
			),
	};
}

export const constraints = storyKit({
	...onPostgres,
	create: constraintEngine,
	name: "PostgreSQL constraint mapping",
	stages: ["rows"],
	verbs: (engine, story) => constraintVerbs(engine, story.tell),
});

export function itemStored(name: string, quantity: number) {
	return constraints.trait("rows", `item ${name} with quantity ${quantity} is stored`, ({ items }) => items.insertVoid({ name, quantity }));
}
