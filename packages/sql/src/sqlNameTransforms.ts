import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlNameTransforms } from "#clientOptions.ts";

export const sqlNameTransforms = Effect.gen(function* () {
	const client = yield* SqlClient.SqlClient;
	const namedClient: SqlClient.SqlClient & { readonly config?: SqlNameTransforms } = client;
	return namedClient.config;
});
