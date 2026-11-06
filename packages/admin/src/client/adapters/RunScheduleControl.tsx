import { Option } from "effect";
import { useAction } from "@shivaedev/react/client/resultState.ts";
import { JobButton } from "./JobButton.tsx";
import type { RunScheduleNow } from "./jobsTypes.ts";

export function RunScheduleControl({ queue, run }: { readonly queue: string; readonly run: RunScheduleNow }) {
	const action = useAction(run);
	const failure = Option.isSome(action.cause) ? <p role="alert">Could not run this schedule.</p> : null;
	const status = Option.isSome(action.data) ? <p role="status">{Option.isSome(action.data.value) ? "Run requested." : "No run enqueued."}</p> : null;
	return (
		<div className="space-y-2">
			<JobButton disabled={action.pending} onClick={() => action.dispatch({ queue })}>
				{action.pending ? "Requesting…" : "Run now"}
			</JobButton>
			{failure}
			{status}
		</div>
	);
}
