import { Effect, Schema, Stream } from "effect";
import { identity } from "effect/Function";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clientOptions } from "#clientOptions.ts";
import { postgresLayer } from "#postgresLayer.ts";
import { makeRepository } from "#repository.ts";
import { configured, postgresOptions } from "./postgres.ts";
import { ownTable, records, uniqueTable } from "./writeTables.ts";

class DatedRow extends Model.Class<DatedRow>("DatedRow")({
	createdAt: Schema.Date,
	id: Schema.Int,
}) {}

interface Dated {
	readonly createdAt: Date;
	readonly id: number;
}

const UPDATE_CREATED_AT = { updateColumns: ["createdAt"] } as const;
const WHEN_NEWER = { updateColumns: ["createdAt"], updateWhere: { createdAt: { lt: { excluded: "createdAt" } } } } as const;

function printed(date: Date) {
	return date.toISOString().slice(11, 16);
}

function plain({ createdAt, id }: Dated) {
	return { createdAt, id };
}

function datedEngine(column: string) {
	return Effect.fnUntraced(function* () {
		const sql = yield* SqlClient.SqlClient;
		const tableName = uniqueTable("client_names");
		yield* ownTable(sql, tableName, sql`id integer primary key, ${sql.literal(`"${column}"`)} timestamptz not null`);
		return {
			records: records(),
			rows: yield* makeRepository(DatedRow, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "DatedRow", tableName }),
			sql,
			tableName,
		};
	});
}

type DatedEngine = Effect.Success<ReturnType<ReturnType<typeof datedEngine>>>;

function datedVerbs({ records: { returned }, rows, sql, tableName }: DatedEngine, tell: (line: string) => void) {
	function keep<A>(value: A) {
		returned.push(value);
	}
	return {
		findByCreatedAt: (createdAt: Date) =>
			rows.findMany({ orderBy: { direction: "asc", field: "createdAt" }, select: ["createdAt"], where: { createdAt } }),
		findById: () => Effect.map(rows.findById(1), plain),
		insertRaw: (createdAt: Date) =>
			Effect.suspend(() => {
				tell(`raw SQL inserts row 1 created at ${printed(createdAt)} with sql.insert of the record { createdAt, id }`);
				return Effect.asVoid(sql`insert into ${sql(tableName)} ${sql.insert({ createdAt, id: 1 })}`);
			}),
		insertRow: (createdAt: Date) =>
			Effect.suspend(() => {
				tell(`the repository inserts row 1 created at ${printed(createdAt)}`);
				return Effect.map(rows.insert({ createdAt, id: 1 }), (row) => keep(plain(row)));
			}),
		rawCreatedAtStream: () => Stream.runCollect(sql`select created_at from ${sql(tableName)}`.stream),
		rawCreatedAtWhere: (createdAt: Date) => sql`select created_at from ${sql(tableName)} where ${sql("createdAt")} = ${createdAt}`,
		rawCreatedAtWithRowId: () => sql`select "createdAt", id as row_id from ${sql(tableName)}`,
		returned: () => Effect.sync(() => returned.at(-1)),
		storedCreatedAt: () => sql`select created_at from ${sql(tableName)}`.withoutTransform,
		syncWhenNewer: (createdAt: Date) =>
			Effect.suspend(() => {
				tell(`a conditional upsert offers row 1 created at ${printed(createdAt)}, applied only when it is newer`);
				return Effect.map(rows.upsert({ createdAt, id: 1 }, WHEN_NEWER), (result) =>
					keep("row" in result ? `${result.inserted ? "inserted" : "updated"} ${printed(result.row.createdAt)}` : "unchanged"),
				);
			}),
		updateRow: (createdAt: Date) =>
			Effect.suspend(() => {
				tell(`the repository updates row 1 to created at ${printed(createdAt)}`);
				return Effect.map(rows.update({ createdAt, id: 1 }), (row) => keep(plain(row)));
			}),
		upsertMany: (inputs: readonly Dated[]) =>
			Effect.suspend(() => {
				tell(`upsertMany offers ${inputs.map(({ createdAt, id }) => `row ${id} created at ${printed(createdAt)}`).join(" and ")}`);
				return Effect.map(rows.upsertMany(inputs, UPDATE_CREATED_AT), (results) =>
					keep(results.map(({ inserted, row }) => ({ inserted, row: plain(row) }))),
				);
			}),
		upsertRow: (createdAt: Date) =>
			Effect.suspend(() => {
				tell(`upsert offers row 1 created at ${printed(createdAt)}`);
				return Effect.map(rows.upsert({ createdAt, id: 1 }, UPDATE_CREATED_AT), ({ inserted, row }) => keep({ inserted, row: plain(row) }));
			}),
	};
}

function namesKit(name: string, column: string, options: object) {
	return storyKit({
		clock: "live",
		create: datedEngine(column),
		layer: postgresLayer(postgresOptions.url, { ...postgresOptions, ...options }),
		name,
		runIf: configured,
		stages: ["rows"],
		verbs: (engine, story) => datedVerbs(engine, story.tell),
	});
}

export const snakeCaseNames = namesKit("snake_case SQL names", "created_at", clientOptions({}));
export const preservedNames = namesKit("preserved SQL names", "createdAt", clientOptions({}, { snakeCase: false }));
export const customNames = namesKit(
	"custom SQL names",
	"createdAt",
	clientOptions({ transformQueryNames: identity, transformResultNames: identity }),
);

export function datedRowExists(kit: typeof snakeCaseNames, createdAt: Date) {
	return kit.trait("rows", `row 1 created at ${printed(createdAt)} exists`, ({ rows }) => Effect.asVoid(rows.insert({ createdAt, id: 1 })));
}
