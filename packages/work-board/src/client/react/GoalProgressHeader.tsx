import { Option } from "effect";
import { useId } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { Document } from "#browser/document/schema.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { GoalProgressSummary } from "./GoalProgressSummary.tsx";
import type { ShellApi } from "./ShellApi.ts";

export function GoalProgressHeader({ api, document }: { readonly api: ShellApi; readonly document: Document }) {
	const headingId = useId();
	const progress = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const data = Option.getOrUndefined(progress.data);
	const goal = data?.goals.find((entry) => entry.id === document.identity) ?? data?.closedGoals.find((entry) => entry.id === document.identity);
	return (
		<section aria-labelledby={headingId} className="document-lead col-span-full max-w-[68ch] space-y-4" data-goal-section="progress">
			<h2 className="font-semibold text-xl" id={headingId}>
				Progress
			</h2>
			{goal ? (
				<>
					<p>
						{goal.linked} linked items · <span data-goal-open-asks>{goal.openAsks} open asks</span>
					</p>
					<GoalProgressSummary bar counts={goal.counts} />
				</>
			) : (
				<p role="status">{progress.pending ? "Loading goal progress…" : "Progress is available for uniquely identified projects."}</p>
			)}
			{Option.isSome(progress.cause) && <p role="status">Goal progress refresh failed.</p>}
		</section>
	);
}
