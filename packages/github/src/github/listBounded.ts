import { Effect, type Schema, Stream } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { listPages } from "#github/listPages.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import type { ListOptions } from "#pagedLists.ts";

export function listBounded(state: GitHubState) {
	return Effect.fn("GitHub.listBounded")(
		<TSchema extends Schema.Constraint, E = ServiceUnavailable>(path: string, schema: TSchema, pageCap: number, options?: ListOptions<E> | number) =>
			Effect.flatMap(listPages(state)(path, schema, options), (pages) =>
				pages.pipe(
					Stream.take(pageCap),
					Stream.runCollect,
					Effect.map((collected) => ({
						items: collected.flatMap((page) => page.items),
						skipped: collected.reduce((count, page) => count + page.skipped, 0),
						truncated: collected.at(-1)?.hasNext ?? false,
					})),
				),
			),
	);
}
