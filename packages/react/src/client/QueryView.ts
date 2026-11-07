import { Option } from "effect";
import { createElement, Fragment, type ReactNode } from "react";
import { rethrowQueryDefect } from "#client/adapters/rethrowQueryDefect.ts";
import type { QueryState } from "#client/resultState.ts";

export interface QueryViewProps<A, E> {
	readonly content: (data: A, query: QueryState<A, E>) => ReactNode;
	readonly failure: (error: E, query: QueryState<A, E>) => ReactNode;
	readonly loading: (query: QueryState<A, E>) => ReactNode;
	readonly query: QueryState<A, E>;
}

export function QueryView<A, E>({ query, loading, content, failure }: QueryViewProps<A, E>): ReactNode {
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
