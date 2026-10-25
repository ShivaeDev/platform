import { type LoaderFnContext, notFound } from "@tanstack/react-router";
import { Predicate } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "./loadQuery.ts";

export function queryRoute<TParams extends object, TSearch extends object, A, E>(
	query: (route: { readonly params: TParams; readonly search: TSearch }) => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
	return {
		loader: async (
			context: Pick<LoaderFnContext, "abortController"> & {
				readonly context: { readonly registry: AtomRegistry.AtomRegistry };
				readonly deps: TSearch;
				readonly params: TParams;
			},
		): Promise<A> => {
			try {
				return await loadQuery(context.context.registry, query({ params: context.params, search: context.deps }), context);
			} catch (error) {
				if (Predicate.isTagged(error, "NotFound")) {
					throw notFound();
				}
				throw error;
			}
		},
		loaderDeps: ({ search }: { readonly search: TSearch }) => search,
	};
}
