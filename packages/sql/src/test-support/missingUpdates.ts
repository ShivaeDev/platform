import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import { BatchReading, Measurement } from "./batchModels.ts";
import { KeyPrefix } from "./conflictModels.ts";
import { onPostgres } from "./engines.ts";
import { attempt, endingOf } from "./outcome.ts";
import { ownTable, readEndings, readReturned, recorded, recording, records, statementKinds, statementLog, uniqueTable } from "./writeTables.ts";

const SOURCE_PREFIX = "encoded/";

export type Then = "commits" | "fails";

function encoded<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.provideService(effect, KeyPrefix, SOURCE_PREFIX);
}

const missingEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = { measurements: uniqueTable("missing_measurements"), readings: uniqueTable("missing_readings") };
	yield* ownTable(
		sql,
		tables.readings,
		sql`id integer generated always as identity primary key, source text not null, amount text not null, label text not null, note text`,
	);
	yield* ownTable(sql, tables.measurements, sql`source text, sequence integer, amount text, primary key (source, sequence)`);
	const announced: string[] = [];
	const announcedBeforeCommit: string[] = [];
	return {
		announced,
		announcedBeforeCommit,
		log: statementLog(),
		measurements: yield* makeRepository(Measurement, {
			idColumn: ["source", "sequence"],
			spanPrefix: "MissingMeasurement",
			tableName: tables.measurements,
		}),
		readings: yield* makeRepository(BatchReading, { idColumn: "id", spanPrefix: "MissingReading", tableName: tables.readings }),
		records: records(),
		tables,
	};
});

type MissingEngine = Effect.Success<ReturnType<typeof missingEngine>>;

function missingVerbs(
	{ announced, announcedBeforeCommit, log, measurements, readings, records: outcomes }: MissingEngine,
	tell: (line: string) => void,
) {
	function record<R>(ending: Effect.Effect<string, never, R>) {
		return recorded(outcomes, ending);
	}
	function keep<A extends object, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.tap(effect, (row) => Effect.sync(() => outcomes.returned.push({ ...row })));
	}
	function inTransaction<A, E, R>(effect: Effect.Effect<A, E, R>, then: Then) {
		return transact(
			Effect.gen(function* () {
				const row = yield* effect;
				announcedBeforeCommit.push(...announced);
				return then === "fails" ? yield* Effect.fail("cancelled") : row;
			}),
			{ onSqlError: (error) => error },
		);
	}
	return {
		announced: () => Effect.sync(() => [...announced]),
		announcedBeforeCommit: () => Effect.sync(() => [...announcedBeforeCommit]),
		endings: () => readEndings(outcomes),
		measurement: (sequence: number) =>
			encoded(Effect.map(attempt(measurements.findById({ sequence, source: "meter" })), (row) => (typeof row === "string" ? row : { ...row }))),
		reading: (id = 1) => Effect.map(attempt(readings.findById(id)), (row) => (typeof row === "string" ? row : { ...row })),
		returned: () => readReturned(outcomes),
		statementKinds: () => statementKinds(log),
		updateMeasurementOrFail: (sequence: number, amount: number, then: Then) =>
			Effect.suspend(() => {
				tell(`a transaction updates measurement meter/${sequence} to amount ${amount} with onMissing "fail", then ${then}`);
				return encoded(
					record(endingOf(inTransaction(keep(measurements.update({ amount, sequence, source: "meter" }, { onMissing: "fail" })), then))),
				);
			}),
		updateReading: (amount: number) =>
			Effect.suspend(() => {
				tell(`an ordinary update sets reading 1 to amount ${amount}`);
				return record(endingOf(readings.update({ amount, id: 1, label: "Draft", source: "meter" })));
			}),
		updateReadingOrFail: (amount: number, then?: Then) =>
			Effect.suspend(() => {
				const update = keep(readings.update({ amount, id: 1, label: "Draft", source: "meter" }, { onMissing: "fail" }));
				tell(
					`${then === undefined ? "an" : "a transaction runs an"} update of reading 1 to amount ${amount} with onMissing "fail"${then === undefined ? "" : `, then ${then}`}`,
				);
				return record(endingOf(recording(log, then === undefined ? update : inTransaction(update, then))));
			}),
	};
}

export const missingUpdates = storyKit({
	...onPostgres,
	create: missingEngine,
	name: "PostgreSQL updates of missing rows",
	stages: ["rows"],
	verbs: (engine, story) => missingVerbs(engine, story.tell),
});

export function readingStored(amount: number) {
	return missingUpdates.trait("rows", `reading 1 from meter labelled Draft is stored with amount ${amount}`, ({ readings }) =>
		readings.insertVoid({ amount, label: "Draft", source: "meter" }),
	);
}

export function measurementStored(sequence: number, amount: number) {
	return missingUpdates.trait(
		"rows",
		`measurement meter/${sequence} with amount ${amount} is stored, its source encoded as ${SOURCE_PREFIX}meter`,
		({ measurements }) => Effect.provideService(measurements.insertVoid({ amount, sequence, source: "meter" }), KeyPrefix, SOURCE_PREFIX),
	);
}

export function changesWatched(table: "measurements" | "readings", rowKeys: readonly string[]) {
	return missingUpdates.trait(
		"rows",
		`a subscriber watches the ${table} table and its row keys ${rowKeys.join(", ")}`,
		function* ({ announced, tables }) {
			const reactivity = yield* Reactivity.Reactivity;
			for (const key of ["", ...rowKeys]) {
				const actual = key === "" ? tables[table] : `${tables[table]}:${key}`;
				const named = key === "" ? table : `${table}:${key}`;
				const cancel = reactivity.registerUnsafe([actual], () => announced.push(named));
				yield* Effect.addFinalizer(() => Effect.sync(cancel));
			}
		},
	);
}
