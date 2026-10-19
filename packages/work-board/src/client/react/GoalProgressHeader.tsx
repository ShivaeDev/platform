import { Option } from "effect";
import { useId } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import type { GoalCounts } from "#browser/views/GoalsProjection.ts";
import { GoalBreakdown } from "./GoalBreakdown.tsx";
import { GoalProgress } from "./GoalProgress.tsx";
import { goalCountOrder } from "./goalCounts.ts";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { StatusChip } from "./StatusChip.tsx";

const dots = { done: "bg-done", "in progress": "bg-agent-working", "needs you": "bg-needs-you", planned: "bg-deferred" } as const;

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
						{goal.linked} linked items ·{" "}
						<span data-goal-open-asks>
							{goal.openAsks} open {goal.openAsks === 1 ? "ask" : "asks"}
						</span>
					</p>
					<GoalProgress counts={goal.counts} size="large" title="Linked work" />
					<GoalCountList counts={goal.counts} />
					<GoalBreakdown goal={goal} />
				</>
			) : (
				<p role="status">{progress.pending ? "Loading goal progress…" : "Progress is available for uniquely identified projects."}</p>
			)}
			{Option.isSome(progress.cause) && <p role="status">Goal progress refresh failed.</p>}
		</section>
	);
}

function GoalCountList({ counts }: { readonly counts: GoalCounts }) {
	return (
		<ul aria-label="Linked work by state" className="!p-0 !list-none flex flex-wrap gap-x-5 gap-y-2" data-goal-counts="">
			{goalCountOrder.map((status) => (
				<li className="flex items-center gap-2" data-count={counts[status]} data-status={status} key={status}>
					<span aria-hidden="true" className={`size-2 rounded-full ${dots[status]}`} />
					<strong className="tabular-nums">{counts[status]}</strong> <StatusChip status={status} />
				</li>
			))}
		</ul>
	);
}
