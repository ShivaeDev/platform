import { RegistryContext } from "@effect/atom-react";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useContext } from "react";
import { loadedQuery } from "#internal/loadedQuery.ts";
import { useLoaderHandoff } from "#internal/useLoaderHandoff.ts";
import { type QueryOptions, type QueryState, useQuery } from "./resultState.ts";

export interface LoadedQueryState<A, E> extends Omit<QueryState<A, E>, "data" | "result"> {
	readonly data: A;
}

export function useLoaderQuery<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	loaded: NoInfer<A>,
	options: QueryOptions<E> = {},
): LoadedQueryState<A, E> {
	useLoaderHandoff(useContext(RegistryContext), atom);
	return loadedQuery(useQuery(atom, options), loaded);
}
