import { Effect, Option, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import { onPostgres } from "./engines.ts";
import { endingOf } from "./outcome.ts";
import { kept, ownTable, readEndings, readReturned, recorded, records, uniqueTable } from "./writeTables.ts";

class PartialRow extends Model.Class<PartialRow>("PartialRow")({
	a: Schema.String,
	active: Schema.Boolean,
	b: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	kind: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.transform((value: string) => value.toUpperCase()),
			encode: SchemaGetter.transform((value: string) => value.toLowerCase()),
		}),
	),
	retired: Schema.NullOr(Schema.Date),
	value: Schema.Number,
}) {}

const UNMATCHED_KIND = "y\\' or true --";

export interface PartialInput {
	readonly a: string;
	readonly kind: string;
	readonly value: number;
}

export type PartialWrite = "insertManyOrIgnore" | "insertOrIgnore" | "upsert" | "upsertMany";

const partialEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("partial_targets");
	yield* ownTable(
		sql,
		table,
		sql`id integer generated always as identity primary key, a text not null, b text not null, kind text not null, value integer not null, active boolean not null, retired timestamptz`,
	);
	yield* sql`create unique index ${sql(`${table}_key`)} on ${sql(table)} (a, b) where kind = 'x' and b = '1' and active = true and retired is null`;
	const options = { conflictColumns: ["a", "b"], idColumn: "id", spanPrefix: "PartialRow", tableName: table } as const;
	return {
		records: records(),
		rows: yield* makeRepository(PartialRow, { ...options, conflictWhere: { active: true, b: 1, kind: "X", retired: null } }),
		unmatched: yield* makeRepository(PartialRow, { ...options, conflictWhere: { active: true, b: 1, kind: UNMATCHED_KIND, retired: null } }),
	};
});

type PartialEngine = Effect.Success<ReturnType<typeof partialEngine>>;

function printed({ a, kind, value }: PartialRow) {
	return { a, kind, value };
}

function upserted({ inserted, row }: { readonly inserted: boolean; readonly row: PartialRow }) {
	return { inserted, row: printed(row) };
}

function withPairedKey(input: PartialInput) {
	return { ...input, active: true, b: 1, retired: null };
}

function described(rows: readonly PartialInput[]) {
	return rows.map(({ a, kind, value }) => `${a}/1 of kind ${kind} with value ${value}`).join(" and ");
}

function partialVerbs({ records: outcomes, rows, unmatched }: PartialEngine, tell: (line: string) => void) {
	function keep<A, E, R>(effect: Effect.Effect<A, E, R>, print: (value: A) => unknown) {
		return kept(outcomes, effect, print);
	}
	return {
		endings: () => readEndings(outcomes),
		insertFromSelectOrIgnore: () =>
			Effect.suspend(() => {
				tell("insertFromSelectOrIgnore copies the existing rows through the partial target");
				return keep(
					rows.insertFromSelectOrIgnore(rows.select(), { a: "a", active: "active", b: "b", kind: "kind", retired: "retired", value: "value" }),
					(inserted) => inserted.map(printed),
				);
			}),
		insertManyOrIgnore: (inputs: readonly PartialInput[]) =>
			Effect.suspend(() => {
				tell(`insertManyOrIgnore under the partial kind-x target offers ${described(inputs)}`);
				return keep(rows.insertManyOrIgnore(inputs.map(withPairedKey)), (inserted) => inserted.map(printed));
			}),
		insertOrIgnore: (input: PartialInput) =>
			Effect.suspend(() => {
				tell(`insertOrIgnore under the partial kind-x target offers ${described([input])}`);
				return keep(rows.insertOrIgnore(withPairedKey(input)), Option.match({ onNone: () => "ignored", onSome: printed }));
			}),
		returned: () => readReturned(outcomes),
		storedRows: () => Effect.map(rows.findMany({ orderBy: { direction: "asc", field: "id" } }), (stored) => stored.map(printed)),
		upsert: (input: PartialInput) =>
			Effect.suspend(() => {
				tell(`upsert under the partial kind-x target offers ${described([input])}, updating value`);
				return keep(rows.upsert(withPairedKey(input), { updateColumns: ["value"] }), upserted);
			}),
		upsertMany: (inputs: readonly PartialInput[]) =>
			Effect.suspend(() => {
				tell(`upsertMany under the partial kind-x target offers ${described(inputs)}, updating value`);
				return keep(rows.upsertMany(inputs.map(withPairedKey), { updateColumns: ["value"] }), (results) => results.map(upserted));
			}),
		writeThroughUnmatchedTarget: (write: PartialWrite, input: PartialInput) =>
			Effect.suspend(() => {
				tell(`${write} through a repository whose partial target is kind ${UNMATCHED_KIND} offers ${described([input])}`);
				const writes = {
					insertManyOrIgnore: () => endingOf(unmatched.insertManyOrIgnore([withPairedKey(input)])),
					insertOrIgnore: () => endingOf(unmatched.insertOrIgnore(withPairedKey(input))),
					upsert: () => endingOf(unmatched.upsert(withPairedKey(input), { updateColumns: ["value"] })),
					upsertMany: () => endingOf(unmatched.upsertMany([withPairedKey(input)], { updateColumns: ["value"] })),
				};
				return recorded(outcomes, writes[write]());
			}),
	};
}

export const partialTargets = storyKit({
	...onPostgres,
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => onPostgres.around(transact(Effect.scoped(effect), { onSqlError: (error) => error })),
	create: partialEngine,
	name: "PostgreSQL partial conflict targets",
	stages: ["plan", "rows"],
	verbs: (engine, story) => partialVerbs(engine, story.tell),
});

export function partialRowsExist(inputs: readonly PartialInput[]) {
	return partialTargets.trait("rows", `rows exist under a unique (a, b) index limited to kind x: ${described(inputs)}`, ({ rows }) =>
		Effect.forEach(inputs, (input) => rows.insertVoid(withPairedKey(input)), { discard: true }),
	);
}

export function planMode(mode: "auto" | "force_generic_plan") {
	return partialTargets.trait("plan", `PostgreSQL uses ${mode} plans`, () =>
		Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select set_config('plan_cache_mode', ${mode}, true)`),
	);
}
