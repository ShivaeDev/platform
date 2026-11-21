import { type Cause, Option } from "effect";
import { createContext, createElement, Fragment, type ReactNode, useContext } from "react";
import { rethrowQueryDefect } from "#client/adapters/rethrowQueryDefect.ts";
import type { Unhandled } from "#client/failures.ts";
import type { QueryState } from "#client/resultState.ts";
import { useFailureWording } from "#client/useFailureWording.ts";

export interface FailureLayout {
	readonly message: ReactNode;
	readonly retry: () => void;
	readonly retrying: boolean;
}

export interface QueryViewRenderers {
	readonly failure: (failure: FailureLayout) => ReactNode;
	readonly loading: (query: QueryState<unknown, unknown>) => ReactNode;
}

export function FailureMessage({ message, retry, retrying }: FailureLayout): ReactNode {
	return createElement(
		"p",
		{ role: "alert" },
		message,
		" ",
		createElement("button", { disabled: retrying, onClick: retry, type: "button" }, "Retry"),
	);
}

export const defaultQueryViewRenderers: QueryViewRenderers = {
	failure: (failure) => createElement(FailureMessage, failure),
	loading: (query) => createElement("p", { role: "status" }, query.refreshing ? "Refreshing…" : "Loading…"),
};

const QueryViewContext = createContext<QueryViewRenderers>(defaultQueryViewRenderers);

// The application chooses once how every QueryView lays out loading and a failure; the notice host words the failure, and a view may still pass
// its own renderers.
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
	const word = useFailureWording();
	const loading = props.loading ?? defaults.loading;
	const error = Option.flatMap(query.cause, (cause) => {
		rethrowQueryDefect(cause);
		return Option.map(query.refusal, (refusal) => ({ cause, refusal }));
	});
	function failure({ cause, refusal }: { readonly cause: Cause.Cause<E>; readonly refusal: Exclude<E, { readonly _tag: "RpcClientError" }> }) {
		return props.failure === undefined
			? defaults.failure({ message: word(cause), retry: query.refresh, retrying: query.pending })
			: props.failure(refusal, query);
	}
	return createElement(
		Fragment,
		null,
		Option.isSome(query.data) ? content(query.data.value, query) : null,
		query.pending || (Option.isNone(query.data) && Option.isNone(error)) ? loading(query) : null,
		Option.isSome(error) ? failure(error.value) : null,
	);
}
