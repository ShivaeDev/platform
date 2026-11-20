import { Option, Predicate } from "effect";
import { createContext, createElement, Fragment, type ReactNode, useContext } from "react";
import { isRequestRejection, isServerFailure } from "@shivaedev/errors/taxonomy.ts";
import { rethrowQueryDefect } from "#client/adapters/rethrowQueryDefect.ts";
import type { Unhandled } from "#client/failures.ts";
import type { QueryState } from "#client/resultState.ts";

export interface QueryViewRenderers {
	readonly failure: (error: unknown, query: QueryState<unknown, unknown>) => ReactNode;
	readonly loading: (query: QueryState<unknown, unknown>) => ReactNode;
}

export function queryFailureMessage(error: unknown): string {
	return (isRequestRejection(error) || isServerFailure(error)) && Predicate.isString(error.message) && error.message !== ""
		? error.message
		: "Could not load. Try again.";
}

export const defaultQueryViewRenderers: QueryViewRenderers = {
	failure: (error, query) =>
		createElement(
			"p",
			{ role: "alert" },
			queryFailureMessage(error),
			" ",
			createElement("button", { disabled: query.pending, onClick: query.refresh, type: "button" }, "Retry"),
		),
	loading: (query) => createElement("p", { role: "status" }, query.refreshing ? "Refreshing…" : "Loading…"),
};

const QueryViewContext = createContext<QueryViewRenderers>(defaultQueryViewRenderers);

// The application chooses once how every QueryView shows loading and an ordinary failure; a view may still pass its own.
export function QueryViewDefaults({ children, failure, loading }: Partial<QueryViewRenderers> & { readonly children: ReactNode }): ReactNode {
	const inherited = useContext(QueryViewContext);
	return createElement(
		QueryViewContext.Provider,
		{ value: { failure: failure ?? inherited.failure, loading: loading ?? inherited.loading } },
		children,
	);
}

type FailureRenderer<A, E> = (error: E, query: QueryState<A, E>) => ReactNode;

// A query that can fail with a rejection the app declared must say how to show it; the shared ones have a default.
export type QueryViewProps<A, E> = {
	readonly content: (data: A, query: QueryState<A, E>) => ReactNode;
	readonly loading?: ((query: QueryState<A, E>) => ReactNode) | undefined;
	readonly query: QueryState<A, E>;
} & ([Unhandled<E>] extends [never] ? { readonly failure?: FailureRenderer<A, E> | undefined } : { readonly failure: FailureRenderer<A, E> });

export function QueryView<A, E>(props: QueryViewProps<A, E>): ReactNode {
	const { content, query } = props;
	const defaults = useContext(QueryViewContext);
	const loading = props.loading ?? defaults.loading;
	const failure = props.failure ?? defaults.failure;
	const error = Option.flatMap(query.cause, (cause) => {
		rethrowQueryDefect(cause);
		return query.refusal;
	});
	return createElement(
		Fragment,
		null,
		Option.isSome(query.data) ? content(query.data.value, query) : null,
		query.pending || (Option.isNone(query.data) && Option.isNone(error)) ? loading(query) : null,
		Option.isSome(error) ? failure(error.value, query) : null,
	);
}
