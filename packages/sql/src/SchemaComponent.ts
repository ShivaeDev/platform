import { Effect } from "effect";
import { Migrator, type SqlClient } from "effect/sql";

export interface SchemaComponent<R = never> {
	readonly apply: Effect.Effect<unknown, unknown, R | SqlClient.SqlClient>;
	readonly name: string;
	readonly pending: Effect.Effect<string | undefined, unknown, R | SqlClient.SqlClient>;
}

export function runSchemaComponent<A, R>(name: string, effect: Effect.Effect<A, unknown, R>) {
	return effect.pipe(Effect.mapError((cause) => new Migrator.MigrationError({ cause, kind: "Failed", message: `Schema component ${name} failed.` })));
}
