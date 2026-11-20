import { type AnyRouter, type LoaderFnContext, useMatch } from "@tanstack/react-router";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "#adapters/loadQuery.ts";
import { type QueryRouteRedirects, queryRouteFailure } from "#adapters/queryRouteFailure.ts";
import { useQueryRetry } from "#adapters/useQueryRetry.ts";
import type { QueryOptions } from "#client/resultState.ts";
import { type LoadedQueryState, useLoaderQuery } from "#client/useLoaderQuery.ts";

interface QueryRouteInput<TParams, TSearch, TContext> {
	readonly context: TContext;
	readonly params: TParams;
	readonly search: TSearch;
}

interface QueryRouteContext {
	readonly redirects?: QueryRouteRedirects;
	readonly registry: AtomRegistry.AtomRegistry;
}

function useLoadedQuery<TParams, TSearch, A, E, TContext>(
	query: (route: QueryRouteInput<TParams, TSearch, TContext>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): { readonly loaded: A; readonly query: Atom.Atom<AsyncResult.AsyncResult<A, E>> } {
	const match = useMatch<AnyRouter, undefined, false>({ strict: false });
	const { context, params, loaderDeps }: { context: TContext; params: TParams; loaderDeps: TSearch } = match;
	const loaded: A = match.loaderData;
	return { loaded, query: query({ context, params, search: loaderDeps }) };
}

export function queryRoute<TParams extends object, TSearch extends object, A, E, TContext extends QueryRouteContext = QueryRouteContext>(
	query: (route: QueryRouteInput<TParams, TSearch, TContext>) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
	options: { readonly redirects?: QueryRouteRedirects } = {},
) {
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
				throw queryRouteFailure(error, context.location, { ...context.context.redirects, ...options.redirects });
			}
		},
		loaderDeps: ({ search }: { readonly search: TSearch }) => search,
		useLoaded: () => useLoadedQuery(query),
		useQuery: (queryOptions: QueryOptions<E> = {}): LoadedQueryState<A, E> => {
			const { loaded, query: atom } = useLoadedQuery(query);
			return useLoaderQuery(atom, loaded, queryOptions);
		},
		useRetry: () =>
			useQueryRetry((match) => {
				const { context, params, loaderDeps }: { context: TContext; params: TParams; loaderDeps: TSearch } = match;
				context.registry.refresh(query({ context, params, search: loaderDeps }));
			}),
	};
}
