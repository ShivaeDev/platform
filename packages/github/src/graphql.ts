import { Effect, type Schema } from "effect";
import { GitHub } from "#github/service.ts";
import type { GraphqlOptions } from "#graphqlRequests.ts";

export function graphql<TSchema extends Schema.Constraint>(query: string, variables: unknown, schema: TSchema, options?: GraphqlOptions) {
	return Effect.flatMap(GitHub, (github) => github.graphql(query, variables, options).pipe(Effect.flatMap((response) => response.decode(schema))));
}
