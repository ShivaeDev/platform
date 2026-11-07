import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type KeysetOrder, keysetPage } from "#keysetPage.ts";
import { onPostgres } from "#test/engines.ts";
import { attempt } from "#test/outcome.ts";
import { ownTable, recording, statementLog, uniqueTable } from "#test/writeTables.ts";

const Row = Schema.Struct({ cursorAt: Schema.String, id: Schema.Number, rank: Schema.NumberFromString, seenAt: Schema.Date });
type Row = typeof Row.Type;
interface Cursor {
	readonly at: string;
	readonly id: number;
	readonly rank: number;
}
interface PageOptions {
	readonly after?: Cursor;
	readonly direction?: "asc" | "desc";
	readonly limit: number;
	readonly sort?: "rank" | "time" | "rankAndTime" | "id";
	readonly tieDirection?: "asc" | "desc";
}

const create = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("keyset_rows");
	yield* ownTable(sql, table, sql`id integer primary key, rank numeric not null, seen_at timestamptz not null, owner text not null`);
	const log = statementLog();
	const fetched: number[][] = [];
	function readPage(options: PageOptions) {
		const direction = options.direction ?? "asc";
		const sort = options.sort ?? "rank";
		const rank: KeysetOrder<Cursor> = { column: sql`r.rank`, direction, value: (cursor) => cursor.rank };
		const time: KeysetOrder<Cursor> = { column: sql`r.seen_at`, direction, value: (cursor) => cursor.at };
		const ordering = { id: [], rank: [rank], rankAndTime: [rank, time], time: [time] } as const;
		return keysetPage({
			after: options.after,
			cursorFor: (row: Row): Cursor => ({ at: row.cursorAt, id: row.id, rank: row.rank }),
			limit: options.limit,
			orderBy: ordering[sort],
			read: ({ limit, orderBy, seek }) =>
				recording(
					log,
					sql`select r.id, r.rank, r.seen_at as "seenAt", to_json(r.seen_at) #>> '{}' as "cursorAt"
						from ${sql(table)} r where r.owner = ${"alice"} and ${seek} order by ${orderBy} limit ${limit}`.pipe(
						Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Row))),
						Effect.tap((rows) => Effect.sync(() => fetched.push(rows.map((row) => row.id)))),
					),
				),
			tieBreaker: { column: sort === "id" ? "id" : sql`r.id`, direction: options.tieDirection ?? direction, value: (cursor) => cursor.id },
		});
	}
	return { fetched, log, readPage, sql, table };
});

export const keysetPages = storyKit({
	...onPostgres,
	create,
	name: "PostgreSQL keyset pages",
	stages: ["rows"],
	verbs: (engine, story) => ({
		attemptPage: (limit: number) => attempt(engine.readPage({ limit })),
		readPage: (options: PageOptions) => {
			story.tell(`read up to ${options.limit} rows after ${options.after?.id ?? "the beginning"}`);
			return engine.readPage(options);
		},
		rowsFetched: () => Effect.sync(() => engine.fetched.at(-1)),
		statementsSent: () => Effect.sync(() => engine.log.statements.length),
	}),
});

export function tiedRows() {
	return keysetPages.trait(
		"rows",
		"alice has ids 1-3 at rank 1 and id 4 at rank 2; ids 1 and 3 tie at .123002, id 2 is at .123001 and id 4 at .123999; bob has an earlier row",
		({ sql, table }) =>
			sql`insert into ${sql(table)} (id, rank, seen_at, owner) values
				(1, 1, '2026-01-01T00:00:00.123002Z', 'alice'),
				(2, 1, '2026-01-01T00:00:00.123001Z', 'alice'),
				(3, 1, '2026-01-01T00:00:00.123002Z', 'alice'),
				(4, 2, '2026-01-01T00:00:00.123999Z', 'alice'),
				(5, 1, '2026-01-01T00:00:00.123000Z', 'bob')`,
	);
}
