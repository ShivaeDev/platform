import { Cause, Option, Predicate } from "effect";
import type { ReactNode } from "react";
import type { QueryState } from "@shivaedev/react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";

export function QueryPanel<A, E>({ state, children }: { readonly state: QueryState<A, E>; readonly children: (value: A) => ReactNode }) {
	const denied = Option.exists(Option.flatMap(state.cause, Cause.findErrorOption), (error) => Predicate.isTagged(error, "Forbidden"));
	return (
		<div className="space-y-4">
			<Button disabled={state.pending} onClick={state.refresh} variant="outline">
				{state.refreshing ? "Refreshing…" : "Refresh"}
			</Button>
			{state.pending && Option.isNone(state.data) && <p role="status">Loading…</p>}
			{Option.isSome(state.cause) && <p role="alert">{denied ? "Administrator role required." : "Could not load this view. Try refreshing."}</p>}
			{Option.isSome(state.data) && children(state.data.value)}
		</div>
	);
}
