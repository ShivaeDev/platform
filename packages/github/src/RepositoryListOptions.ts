import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { ListOptions } from "#pagedLists.ts";

export interface RepositoryListOptions<E = ServiceUnavailable> extends ListOptions<E> {
	readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
}
