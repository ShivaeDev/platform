import { type LoaderFnContext, notFound } from "@tanstack/react-router";
import { Predicate } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "#adapters/loadQuery.ts";

export function queryRoute<
	TParams extends object,
	TSearch extends object,
	A,
	E,
	TContext extends { readonly registry: AtomRegistry.AtomRegistry } = { readonly registry: AtomRegistry.AtomRegistry },
>(query: (route: { readonly params: TParams; readonly search: TSearch; readonly context: TContext }) => Atom.Atom<AsyncResult.AsyncResult<A, E>>) {
	return {
		loader: async (
			context: Pick<LoaderFnContext, "abortController"> & {
				readonly context: TContext;
				readonly deps: TSearch;
				readonly params: TParams;
			},
		): Promise<A> => {
			try {
				return await loadQuery(context.context.registry, query({ context: context.context, params: context.params, search: context.deps }), context);
			} catch (error) {
				if (Predicate.isTagged(error, "NotFound")) {
					throw notFound({ data: error });
				}
				throw error;
			}
		},
		loaderDeps: ({ search }: { readonly search: TSearch }) => search,
	};
}
