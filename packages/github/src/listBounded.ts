import { Effect, type Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { listPages } from "#listPages.ts";
import type { ListOptions } from "#pagedLists.ts";

export function listBounded<TSchema extends Schema.Constraint, E = ServiceUnavailable>(
	path: string,
	schema: TSchema,
	pageCap: number,
	options?: ListOptions<E> | number,
) {
	return listPages(path, schema, options).pipe(
		Stream.take(pageCap),
		Stream.runCollect,
		Effect.map((pages) => ({
			items: pages.flatMap((page) => page.items),
			skipped: pages.reduce((count, page) => count + page.skipped, 0),
			truncated: pages.at(-1)?.hasNext ?? false,
		})),
	);
}
