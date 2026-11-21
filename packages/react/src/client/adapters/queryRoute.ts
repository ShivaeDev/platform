import { type AnyRouteMatch, type AnyRouter, type LoaderFnContext, useMatch } from "@tanstack/react-router";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "#adapters/loadQuery.ts";
import { useQueryRetry } from "#adapters/useQueryRetry.ts";
import type { FailureChoices, QueryFailuresOption, Unhandled } from "#client/failures.ts";
import { type LoadedQueryState, useLoadedQueryState } from "#client/useLoaderQuery.ts";
import { type QueryRouteRedirects, queryRouteFailure } from "#queryRouteFailure.ts";

interface QueryRouteInput<TParams, TSearch, TContext> {
	readonly context: TContext;
	readonly params: TParams;
	readonly search: TSearch;
}

interface QueryRouteContext {
	readonly redirects?: QueryRouteRedirects;
	readonly registry: AtomRegistry.AtomRegistry;
}

export type QueryRouteOptions<E> = { readonly redirects?: QueryRouteRedirects } & QueryFailuresOption<E>;

// Options are required while the query can fail with a rejection the app declared, so the route names what it shows.
export type QueryRouteArguments<E> = [Unhandled<E>] extends [never] ? [options?: QueryRouteOptions<E>] : [options: QueryRouteOptions<E>];

function useLoadedQuery<TParams, TSearch, A, E, TContext>(
	query: (route: QueryRouteInput<TParams, TSearch, TContext>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): { readonly loaded: A; readonly query: Atom.Atom<AsyncResult.AsyncResult<A, E>> } {
	const match = useMatch<AnyRouter, undefined, false>({ strict: false });
	const { context, params, loaderDeps }: { context: TContext; params: TParams; loaderDeps: TSearch } = match;
	const loaded: A = match.loaderData;
	return { loaded, query: query({ context, params, search: loaderDeps }) };
}

function refreshMatch<TParams, TSearch, A, E, TContext extends QueryRouteContext>(
	query: (route: QueryRouteInput<TParams, TSearch, TContext>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	match: AnyRouteMatch,
): void {
	const { context, params, loaderDeps }: { context: TContext; params: TParams; loaderDeps: TSearch } = match;
	context.registry.refresh(query({ context, params, search: loaderDeps }));
}

export function queryRoute<TParams extends object, TSearch extends object, A, E, TContext extends QueryRouteContext = QueryRouteContext>(
	query: (route: QueryRouteInput<TParams, TSearch, TContext>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	...[options]: NoInfer<QueryRouteArguments<E>>
) {
	const queryFailures: FailureChoices["failures"] = options?.failures;
	return {
		loader: async (
			context: Pick<LoaderFnContext, "abortController" | "location"> & {
				readonly context: TContext;
				readonly deps: TSearch;
				readonly params: TParams;
			},
		): Promise<A> => {
			try {
				return await loadQuery(context.context.registry, query({ context: context.context, params: context.params, search: context.deps }), context);
			} catch (error) {
				throw queryRouteFailure(error, context.location, { ...context.context.redirects, ...options?.redirects });
			}
		},
		loaderDeps: ({ search }: { readonly search: TSearch }) => search,
		// Spread into the route's options, so the router's default failure screen can word this route's rejections and rerun its own query.
		queryFailures,
		refreshQuery: (match: AnyRouteMatch) => refreshMatch(query, match),
		useLoaded: () => useLoadedQuery(query),
		useQuery: (queryOptions: { readonly keepPreviousData?: boolean } = {}): LoadedQueryState<A, E> => {
			const { loaded, query: atom } = useLoadedQuery(query);
			return useLoadedQueryState(atom, loaded, { failures: queryFailures, keepPreviousData: queryOptions.keepPreviousData });
		},
		useRetry: () => useQueryRetry((match) => refreshMatch(query, match)),
	};
}
