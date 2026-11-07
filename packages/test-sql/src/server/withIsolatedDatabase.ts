import { Effect } from "effect";
import { isolateDatabase } from "#server/adapters/isolateDatabase.ts";
import { connectionLimitHint } from "#server/connectionLimitHint.ts";
import type { PostgresTestTemplate } from "#server/database.ts";

export function withIsolatedDatabase<A, E, R>(effect: Effect.Effect<A, E, R>, options?: { readonly template?: PostgresTestTemplate }) {
	return Effect.scoped(isolateDatabase(effect, options)).pipe(Effect.mapError(connectionLimitHint));
}
