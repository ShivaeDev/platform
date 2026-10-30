import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { BatchReading, Generated, Measurement, type ReadingInput, WIDE_COLUMNS, Wide } from "./batchModels.ts";
import { KeyPrefix } from "./conflictModels.ts";
import { onPostgres } from "./engines.ts";
import { kept, ownTable, readEndings, readReturned, records, uniqueTable } from "./writeTables.ts";

const SOURCE_PREFIX = "encoded/";

export type BatchWrite = "insertMany" | "insertManyOrIgnore" | "upsertMany";

export type ReadingColumn = "amount" | "id" | "label" | "missing" | "note" | "source";

const readingEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("batch_readings");
	const audit = uniqueTable("batch_audit");
	const calls = uniqueTable("batch_calls");
	const trigger = uniqueTable("batch_trigger");
	yield* ownTable(
		sql,
		table,
		sql`id integer generated always as identity primary key, source text unique not null,
			amount text not null check (amount::numeric >= 0), label text not null, note text default 'default note'`,
	);
	yield* ownTable(sql, audit, sql`rows integer not null`);
	yield* Effect.acquireRelease(sql`create sequence ${sql(calls)}`, () => Effect.orDie(sql`drop sequence if exists ${sql(calls)}`));
	yield* Effect.acquireRelease(
		sql`create function ${sql(trigger)}() returns trigger language plpgsql as ${sql.literal(`'begin
			perform nextval(''${calls}'');
			insert into ${audit} select count(*) from inserted;
			return null;
		end'`)}`,
		() => Effect.orDie(sql`drop function if exists ${sql(trigger)}() cascade`),
	);
	yield* sql`create trigger record_batch after insert on ${sql(table)} referencing new table as inserted for each statement execute function ${sql(trigger)}()`;
	const options = { idColumn: "id", spanPrefix: "BatchReading", tableName: table } as const;
	return {
		audit,
		calls,
		plain: yield* makeRepository(BatchReading, options),
		readings: yield* makeRepository(BatchReading, { ...options, conflictColumns: ["source"] }),
		records: records(),
		sql,
		table,
	};
});

type ReadingEngine = Effect.Success<ReturnType<typeof readingEngine>>;

function printed({ amount, label, note, source }: BatchReading) {
	return { amount, label, note, source };
}

function parsed<A>(json: string): A {
	return JSON.parse(json);
}

function readingVerbs({ audit, calls, plain, readings, records: outcomes, sql, table }: ReadingEngine, tell: (line: string) => void) {
	function keep<A, E, R>(effect: Effect.Effect<A, E, R>, print: (value: A) => unknown) {
		return kept(outcomes, effect, print);
	}
	function write(kind: BatchWrite, rows: readonly ReadingInput[], updateColumns: readonly ReadingColumn[] = ["amount"]) {
		if (kind === "upsertMany") {
			const columns = parsed<readonly ["amount"]>(JSON.stringify(updateColumns));
			return keep(readings.upsertMany(rows, { updateColumns: columns }), (results) =>
				results.map(({ inserted, row }) => ({ inserted, ...printed(row) })),
			);
		}
		return keep(kind === "insertMany" ? plain.insertMany(rows) : readings.insertManyOrIgnore(rows), (inserted) => inserted.map(printed));
	}
	return {
		endings: () => readEndings(outcomes),
		insertedPerStatement: () => Effect.map(sql<{ readonly rows: number }>`select rows from ${sql(audit)}`, (rows) => rows.map((row) => row.rows)),
		returned: () => readReturned(outcomes),
		statementsRun: () =>
			Effect.map(
				sql<{ readonly calls: number }>`select case when is_called then last_value else 0 end::int as calls from ${sql(calls)}`,
				([row]) => row?.calls,
			),
		storedCount: () => Effect.map(sql<{ readonly count: number }>`select count(*)::int as count from ${sql(table)}`, ([row]) => row?.count),
		storedNotes: () =>
			Effect.map(plain.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["note"] }), (rows) => rows.map(({ note }) => note)),
		storedReading: (source: string) => Effect.map(plain.findMany({ where: { source } }), (rows) => rows.map(printed)),
		writeBatch: (kind: BatchWrite, rows: readonly ReadingInput[], updateColumns?: readonly ReadingColumn[]) =>
			Effect.suspend(() => {
				const updating = kind === "upsertMany" ? `, updating ${(updateColumns ?? ["amount"]).join(", ") || "no columns"}` : "";
				tell(`${kind} writes ${rows.length} readings${updating}`);
				return write(kind, rows, updateColumns);
			}),
		writeRowMissingFields: () =>
			Effect.suspend(() => {
				tell("insertMany writes a reading that has only a source");
				return keep(plain.insertMany(parsed<ReadingInput[]>('[{"source":"missing-fields"}]')), (rows) => rows.map(printed));
			}),
	};
}

export const batchReadings = storyKit({
	...onPostgres,
	create: readingEngine,
	name: "PostgreSQL batch writes",
	stages: ["rows"],
	verbs: (engine, story) => readingVerbs(engine, story.tell),
});

export function readingsStored(rows: readonly ReadingInput[]) {
	return batchReadings.trait(
		"rows",
		`${rows.length} readings are stored, and the statement audit starts after them`,
		function* ({ audit, plain, sql }) {
			yield* plain.insertMany(rows);
			yield* sql`delete from ${sql(audit)}`;
		},
	);
}

const shapeEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = { generated: uniqueTable("batch_generated"), measurements: uniqueTable("batch_measurements"), wide: uniqueTable("batch_wide") };
	yield* ownTable(sql, tables.generated, sql`id integer generated always as identity primary key`);
	yield* ownTable(sql, tables.measurements, sql`source text, sequence integer, amount text, primary key (source, sequence)`);
	yield* ownTable(sql, tables.wide, sql`id integer primary key, ${sql.csv(WIDE_COLUMNS.map((column) => sql`${sql(column)} integer not null`))}`);
	return {
		generated: yield* makeRepository(Generated, { idColumn: "id", spanPrefix: "BatchGenerated", tableName: tables.generated }),
		measurements: yield* makeRepository(Measurement, {
			conflictColumns: ["source", "sequence"],
			idColumn: ["source", "sequence"],
			spanPrefix: "BatchMeasurement",
			tableName: tables.measurements,
		}),
		records: records(),
		sql,
		tables,
		wide: yield* makeRepository(Wide, { idColumn: "id", spanPrefix: "BatchWide", tableName: tables.wide }),
	};
});

type ShapeEngine = Effect.Success<ReturnType<typeof shapeEngine>>;

export function wideRow(id: number) {
	return { ...Object.fromEntries(WIDE_COLUMNS.map((column) => [column, 1])), id };
}

function measurement({ amount, sequence, source }: Measurement) {
	return { amount, sequence, source };
}

function shapeVerbs({ generated, measurements, records: outcomes, sql, tables, wide }: ShapeEngine, tell: (line: string) => void) {
	function keep<A, E, R>(effect: Effect.Effect<A, E, R>, print: (value: A) => unknown) {
		return kept(outcomes, Effect.provideService(effect, KeyPrefix, SOURCE_PREFIX), print);
	}
	return {
		endings: () => readEndings(outcomes),
		insertGeneratedRows: (count: number) =>
			Effect.suspend(() => {
				tell(`insertMany writes ${count} rows that have only a database-generated id`);
				return keep(generated.insertMany(Array.from({ length: count }, () => ({}))), (rows) => rows.map(({ id }) => ({ id })));
			}),
		insertMeasurementsOrIgnore: (rows: readonly (typeof Measurement)["insert"]["Type"][]) =>
			Effect.suspend(() => {
				tell(`insertManyOrIgnore writes measurements ${rows.map(({ sequence, source }) => `${source}/${sequence}`).join(", ")}`);
				return keep(measurements.insertManyOrIgnore(rows), (inserted) => inserted.map(measurement));
			}),
		insertWideRows: (count: number) =>
			Effect.suspend(() => {
				tell(`insertMany writes ${count} rows of ${WIDE_COLUMNS.length + 1} columns each`);
				return keep(wide.insertMany(Array.from({ length: count }, (_, id) => wideRow(id))), (rows) => rows.length);
			}),
		returned: () => readReturned(outcomes),
		storedMeasurements: () => sql`select source, sequence, amount from ${sql(tables.measurements)} order by sequence`,
		storedWideRow: (id: number) => Effect.map(wide.findById(id), (row) => ({ ...row })),
		upsertMeasurements: (rows: readonly (typeof Measurement)["insert"]["Type"][]) =>
			Effect.suspend(() => {
				tell(
					`upsertMany writes measurements ${rows.map(({ amount, sequence, source }) => `${source}/${sequence} with amount ${amount}`).join(", ")}, updating amount`,
				);
				return keep(measurements.upsertMany(rows, { updateColumns: ["amount"] }), (results) =>
					results.map(({ inserted, row }) => ({ inserted, ...measurement(row) })),
				);
			}),
	};
}

export const batchShapes = storyKit({
	...onPostgres,
	create: shapeEngine,
	name: "PostgreSQL batch row shapes",
	stages: ["rows"],
	verbs: (engine, story) => shapeVerbs(engine, story.tell),
});

export function measurementStored(source: string, sequence: number, amount: number) {
	return batchShapes.trait(
		"rows",
		`measurement ${source}/${sequence} with amount ${amount} is stored, its source encoded as ${SOURCE_PREFIX}${source}`,
		({ measurements }) => Effect.provideService(measurements.insertVoid({ amount, sequence, source }), KeyPrefix, SOURCE_PREFIX),
	);
}
