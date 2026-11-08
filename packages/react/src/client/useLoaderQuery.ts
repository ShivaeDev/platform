import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useLoaderHandoff } from "#adapters/useLoaderHandoff.ts";
import { type QueryOptions, type QueryState, useQuery } from "#client/resultState.ts";
import { loadedQuery } from "#loadedQuery.ts";

export interface LoadedQueryState<A, E> extends Omit<QueryState<A, E>, "data" | "result"> {
	readonly data: A;
}

export function useLoaderQuery<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	loaded: NoInfer<A>,
	options: QueryOptions<E> = {},
): LoadedQueryState<A, E> {
	useLoaderHandoff(atom);
	return loadedQuery(useQuery(atom, options), loaded);
}
