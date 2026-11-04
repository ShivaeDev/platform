import { Effect, type Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { GitHub } from "#GitHub.ts";
import { decodedPages, type ListOptions } from "#pagedLists.ts";

export function listPages<TSchema extends Schema.Constraint, E = ServiceUnavailable>(
	path: string,
	schema: TSchema,
	options?: ListOptions<E> | number,
) {
	return Stream.unwrap(Effect.map(GitHub, (github) => decodedPages(github, path, schema, options)));
}
