import { useContext } from "react";
import { goalState } from "#browser/views/goalWorkState.ts";
import { sameStatus } from "#browser/views/statusLabel.ts";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { type GoalWorkItem, goalRun } from "./goalWork.ts";

export function GoalWorkLink({ item }: { readonly item: GoalWorkItem }) {
	return <a href={`/_board/item/${encodeURIComponent(item.id)}/`}>{item.title}</a>;
}
export function GoalWorkStatus({ item }: { readonly item: GoalWorkItem }) {
	const fleet = useContext(FleetItemsContext);
	const state = goalState(item.metadata.status, goalRun(item, fleet)?.stage);
	const waiting = item.waiting !== undefined && !(state && sameStatus(state, "needs-you"));
	if (!(state || waiting)) {
		return null;
	}
	return (
		<span className="inline-flex flex-wrap gap-1">
			{state ? <StatusChip className="whitespace-nowrap" status={state} /> : null}
			{waiting ? <StatusChip className="whitespace-nowrap" status="needs-you" /> : null}
		</span>
	);
}
