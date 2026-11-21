import { Effect, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { collection } from "@shivaedev/changes/keys.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import { readSql } from "@shivaedev/sql/readSql.ts";
import type { AppModule } from "#AppModule.ts";
import { Reading } from "#test/defined-modules/src/Reading.ts";

const readings = collection("readings", Schema.String);
const decodeReadings = Schema.decodeUnknownEffect(Schema.Array(Reading));

// A raw read has no repository model, so only the class it decodes into can mark pulse sensitive.
const readAll = Effect.fnUntraced(function* () {
	return yield* Effect.orDie(Effect.flatMap(readSql`select day, pulse from readings order by day`, decodeReadings));
});

const Latest = query("latest", {
	payload: {},
	reads: () => [readings.list],
	*run() {
		const all = yield* readAll();
		yield* Effect.annotateCurrentSpan("readings", all);
		yield* Effect.logInfo("readings read", { readings: all });
		return all;
	},
});

const Record = command("record", {
	invalidates: ({ day }) => [readings.item(day)],
	payload: { day: Schema.String, pulse: Schema.Number },
	*run({ day, pulse }) {
		const stored = (yield* readAll()).find((reading) => reading.day === day);
		if (stored !== undefined) {
			return yield* Effect.die({ reading: stored });
		}
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.orDie(sql`insert into readings (day, pulse) values (${day}, ${pulse})`);
		return new Reading({ day, pulse });
	},
});

const Goal = command("goal", {
	invalidates: () => [],
	payload: {},
	*run() {
		const goal = { pulse: 60 };
		yield* Effect.logInfo("goal read", goal);
		return yield* Effect.succeed(goal);
	},
});

// Stands in for the generated wire, which imports the class run returns instead of restating it, and writes goal's plain object as a struct.
export const Readings = defineModule({
	middleware: MaybeAuthenticated,
	name: "readings",
	operations: [Latest, Record, Goal],
	wire: {
		goal: { rejections: {}, success: Schema.Struct({ pulse: Schema.Number }) },
		latest: { rejections: {}, success: Schema.Array(Reading) },
		record: { rejections: {}, success: Reading },
	},
});

export const readingsModule = {
	migrations: {
		loader: Migrator.fromRecord({
			"005_readings": SqlClient.SqlClient.use((sql) => sql`create table readings (day text primary key, pulse integer not null)`),
		}),
	},
	module: Readings,
} satisfies AppModule;
