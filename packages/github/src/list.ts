import { type Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { listPages } from "#listPages.ts";
import type { ListOptions } from "#pagedLists.ts";

export function list<TSchema extends Schema.Constraint, E = ServiceUnavailable>(path: string, schema: TSchema, options?: ListOptions<E> | number) {
	return listPages(path, schema, options).pipe(Stream.flatMap((page) => Stream.fromIterable(page.items)));
}
