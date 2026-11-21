import type { ReactNode } from "react";
import { QueryView } from "@shivaedev/react/client/QueryView.ts";
import type { QueryState } from "@shivaedev/react/client/resultState.ts";
import { JobButton } from "#client/JobButton.tsx";

export function JobsQueryPanel<A>({ state, children }: { readonly state: QueryState<A, unknown>; readonly children: (value: A) => ReactNode }) {
	return (
		<div className="min-w-0 space-y-4">
			<JobButton disabled={state.pending} onClick={state.refresh}>
				Refresh
			</JobButton>
			<QueryView content={children} query={state} />
		</div>
	);
}
