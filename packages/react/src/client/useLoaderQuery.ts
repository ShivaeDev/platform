import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useLoaderHandoff } from "#adapters/useLoaderHandoff.ts";
import type { FailureChoices, QueryFailuresOption, Unhandled } from "#client/failures.ts";
import { type QueryState, useQuery } from "#client/resultState.ts";
import { useLoadedQueryFailures } from "#client/useLoadedQueryFailures.ts";
import { loadedQuery } from "#loadedQuery.ts";

export interface LoadedQueryState<A, E> extends Omit<QueryState<A, E>, "data" | "result"> {
	readonly data: A;
}

export type LoadedQueryOptions<E> = { readonly keepPreviousData?: boolean } & QueryFailuresOption<E>;

// Options are required while the query can fail with a rejection the app declared, so the call names what it shows.
export type LoadedQueryArguments<E> = [Unhandled<E>] extends [never] ? [options?: LoadedQueryOptions<E>] : [options: LoadedQueryOptions<E>];

interface LoadedQueryChoices {
	readonly failures: FailureChoices["failures"];
	readonly keepPreviousData: boolean | undefined;
}

// The callers have already checked the handlers against the query's rejections: `useLoaderQuery` here, `queryRoute` where the route is declared.
export function useLoadedQueryState<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	loaded: A,
	{ failures, keepPreviousData }: LoadedQueryChoices,
): LoadedQueryState<A, E> {
	useLoaderHandoff(atom);
	const query = useQuery(atom, keepPreviousData === undefined ? {} : { keepPreviousData });
	useLoadedQueryFailures(query.result, query.refresh, { failures });
	return loadedQuery(query, loaded);
}

export function useLoaderQuery<A, E>(
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	loaded: NoInfer<A>,
	...[options]: NoInfer<LoadedQueryArguments<E>>
): LoadedQueryState<A, E> {
	return useLoadedQueryState(atom, loaded, { failures: options?.failures, keepPreviousData: options?.keepPreviousData });
}
