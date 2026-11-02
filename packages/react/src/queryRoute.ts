import type { LoaderFnContext } from "@tanstack/react-router";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "#adapters/loadQuery.ts";
import { type QueryRouteRedirects, queryRouteFailure } from "#adapters/queryRouteFailure.ts";
import { useQueryRetry } from "#adapters/useQueryRetry.ts";

interface QueryRouteInput<TParams, TSearch, TContext> {
	readonly context: TContext;
	readonly params: TParams;
	readonly search: TSearch;
}

export function queryRoute<
	TParams extends object,
	TSearch extends object,
	A,
	E,
	TContext extends { readonly registry: AtomRegistry.AtomRegistry } = { readonly registry: AtomRegistry.AtomRegistry },
>(
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
				throw queryRouteFailure(error, context.location, options.redirects);
			}
		},
		loaderDeps: ({ search }: { readonly search: TSearch }) => search,
		useRetry: () =>
			useQueryRetry((match) => {
				const { context, params, loaderDeps }: { context: TContext; params: TParams; loaderDeps: TSearch } = match;
				context.registry.refresh(query({ context, params, search: loaderDeps }));
			}),
	};
}
