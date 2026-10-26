import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class Prefix extends Context.Service<Prefix, string>()("batch/Prefix") {}
export const Source = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
export class Measurement extends Model.Class<Measurement>("BatchMeasurement")({
	amount: Schema.NumberFromString,
	sequence: Schema.Int,
	source: Source,
}) {}
export const compositeMeasurements = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `batch_measurements_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (source text, sequence integer, amount text, primary key (source, sequence))`;
	const readings = yield* makeRepository(Measurement, {
		conflictColumns: ["source", "sequence"],
		idColumn: ["source", "sequence"],
		spanPrefix: "Measurement",
		tableName,
	});
	return { readings, tableName };
});
