import { Effect, Option, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres } from "./engines.ts";
import { endingOf } from "./outcome.ts";
import { kept, ownTable, readEndings, readReturned, recorded, recording, records, statementLog, uniqueTable } from "./writeTables.ts";

class PartialRow extends Model.Class<PartialRow>("PartialRow")({
	a: Schema.String,
	b: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	kind: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.transform((value: string) => value.toUpperCase()),
			encode: SchemaGetter.transform((value: string) => value.toLowerCase()),
		}),
	),
	value: Schema.Number,
}) {}

export const UNMATCHED_KIND = "y' or true --";

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
		sql`id integer generated always as identity primary key, a text not null, b text not null, kind text not null, value integer not null`,
	);
	yield* sql`create unique index ${sql(`${table}_key`)} on ${sql(table)} (a, b) where kind = 'x'`;
	const options = { conflictColumns: ["a", "b"], idColumn: "id", spanPrefix: "PartialRow", tableName: table } as const;
	return {
		log: statementLog(),
		records: records(),
		rows: yield* makeRepository(PartialRow, { ...options, conflictWhere: { kind: "X" } }),
		unmatched: yield* makeRepository(PartialRow, { ...options, conflictWhere: { kind: UNMATCHED_KIND } }),
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
	return { ...input, b: 1 };
}

function described(rows: readonly PartialInput[]) {
	return rows.map(({ a, kind, value }) => `${a}/1 of kind ${kind} with value ${value}`).join(" and ");
}

function partialVerbs({ log, records: outcomes, rows, unmatched }: PartialEngine, tell: (line: string) => void) {
	function keep<A, E, R>(effect: Effect.Effect<A, E, R>, print: (value: A) => unknown) {
		return kept(outcomes, effect, print);
	}
	return {
		endings: () => readEndings(outcomes),
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
		unmatchedPredicate: () =>
			Effect.sync(() => {
				const [text = "", parameters = []] = log.statements.at(-1) ?? [];
				return { bound: parameters.at(-1), inlined: text.includes(UNMATCHED_KIND) };
			}),
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
				return recorded(outcomes, recording(log, writes[write]()));
			}),
	};
}

export const partialTargets = storyKit({
	...onPostgres,
	create: partialEngine,
	name: "PostgreSQL partial conflict targets",
	stages: ["rows"],
	verbs: (engine, story) => partialVerbs(engine, story.tell),
});

export function partialRowsExist(inputs: readonly PartialInput[]) {
	return partialTargets.trait("rows", `rows exist under a unique (a, b) index limited to kind x: ${described(inputs)}`, ({ rows }) =>
		Effect.forEach(inputs, (input) => rows.insertVoid({ ...input, b: 1 }), { discard: true }),
	);
}
