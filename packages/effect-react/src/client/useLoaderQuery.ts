import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { loadedQuery } from "#internal/loadedQuery.ts";
import { type QueryState, useQuery } from "./resultState.ts";

export interface LoadedQueryState<A, E> extends Omit<QueryState<A, E>, "data" | "result"> {
	readonly data: A;
}

export function useLoaderQuery<A, E>(atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>, loaded: NoInfer<A>): LoadedQueryState<A, E> {
	return loadedQuery(useQuery(atom), loaded);
}
