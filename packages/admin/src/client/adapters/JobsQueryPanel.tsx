import { Cause, Option, Predicate } from "effect";
import type { ReactNode } from "react";
import type { QueryState } from "@shivaedev/react/client/resultState.ts";
import { JobButton } from "./JobButton.tsx";

export function JobsQueryPanel<A, E>({ state, children }: { readonly state: QueryState<A, E>; readonly children: (value: A) => ReactNode }) {
	const denied = Option.exists(Option.flatMap(state.cause, Cause.findErrorOption), (error) => Predicate.isTagged(error, "Forbidden"));
	const loading = state.pending && Option.isNone(state.data) ? <p role="status">Loading…</p> : null;
	const failure = Option.isSome(state.cause) ? (
		<p role="alert">{denied ? "Permission required to view jobs." : "Could not load this view. Try refreshing."}</p>
	) : null;
	const content = !denied && Option.isSome(state.data) ? children(state.data.value) : null;
	return (
		<div className="min-w-0 space-y-4">
			<JobButton disabled={state.pending} onClick={state.refresh}>
				{state.refreshing ? "Refreshing…" : "Refresh"}
			</JobButton>
			{loading}
			{failure}
			{content}
		</div>
	);
}
