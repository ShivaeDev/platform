import { Effect } from "effect";
import type { QueryShape } from "#operation.ts";
import type { QueryReference } from "#serverMetadata.ts";

export function resolveQueries(queries: readonly QueryShape[], requested: readonly QueryReference[]) {
	return Effect.forEach(requested, (reference) => {
		const query = queries.find((candidate) => candidate.name === reference.query);
		return query === undefined ? Effect.die(new Error(`Unknown query: ${reference.query}`)) : Effect.succeed({ payload: reference.payload, query });
	});
}
