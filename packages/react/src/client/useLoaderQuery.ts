import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useLoaderHandoff } from "#adapters/useLoaderHandoff.ts";
import type { QueryFailuresOption, Unhandled } from "#client/failures.ts";
import { type QueryState, useQuery } from "#client/resultState.ts";
import { useLoadedQueryFailures } from "#client/useLoadedQueryFailures.ts";
import { loadedQuery } from "#loadedQuery.ts";

export interface LoadedQueryState<A, E> extends Omit<QueryState<A, E>, "data" | "result"> {
	readonly data: A;
}

export type LoadedQueryOptions<E> = { readonly keepPreviousData?: boolean } & QueryFailuresOption<E>;

// Options are required while the query can fail with a rejection the app declared, so the call names what it shows.
export type LoadedQueryArguments<E> = [Unhandled<E>] extends [never] ? [options?: LoadedQueryOptions<E>] : [options: LoadedQueryOptions<E>];

export function useLoaderQuery<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	loaded: NoInfer<A>,
	...[options]: NoInfer<LoadedQueryArguments<E>>
): LoadedQueryState<A, E> {
	useLoaderHandoff(atom);
	const query = useQuery(atom, options?.keepPreviousData === undefined ? {} : { keepPreviousData: options.keepPreviousData });
	useLoadedQueryFailures(query.result, query.refresh, { failures: options?.failures });
	return loadedQuery(query, loaded);
}
