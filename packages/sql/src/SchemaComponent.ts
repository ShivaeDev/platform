import { Effect } from "effect";
import type { SqlClient } from "effect/sql";

export interface SchemaComponent<R = never, E = unknown> {
	readonly apply: Effect.Effect<unknown, E, R | SqlClient.SqlClient>;
	readonly name: string;
	readonly pending: Effect.Effect<string | undefined, E, R | SqlClient.SqlClient>;
}

export function runSchemaComponent<A, E, R>(name: string, effect: Effect.Effect<A, E, R>) {
	return effect.pipe(Effect.tapCause((cause) => Effect.logError(`Schema component ${name} failed.`, cause)));
}
