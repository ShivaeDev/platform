import { Effect, type Schema } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodePages } from "#decodePages.ts";
import { list } from "#github/list.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import type { ListOptions } from "#pagedLists.ts";

export function listPages(state: GitHubState) {
	return Effect.fn("GitHub.listPages")(
		<TSchema extends Schema.Constraint, E = ServiceUnavailable>(path: string, schema: TSchema, options?: ListOptions<E> | number) => {
			const settings = typeof options === "number" ? { responseByteLimit: options } : options;
			return Effect.map(list(state)(path, settings?.beforeRequest, settings?.responseByteLimit), (pages) => decodePages(pages, schema, settings));
		},
	);
}
