import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import type { GoalCounts, GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { Skeleton } from "#client/react/components/ui/skeleton.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { GoalAsks } from "./GoalAsks.tsx";
import { GoalBreakdown } from "./GoalBreakdown.tsx";
import { GoalProgress } from "./GoalProgress.tsx";
import { goalCountOrder, goalStateColors, goalStateLabels } from "./goalCounts.ts";
import { Loading } from "./loading.tsx";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
import { shellIds } from "./shellIds.ts";

export function GoalProgressHeader({ api, document }: { readonly api: ShellApi; readonly document: Document }) {
	const progress = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const data = Option.getOrUndefined(progress.data);
	const goal = [...(data?.goals ?? []), ...(data?.deferredGoals ?? []), ...(data?.closedGoals ?? [])].find((entry) => entry.id === document.identity);
	return (
		<section aria-labelledby={shellIds.goalProgress} className="document-lead col-span-full max-w-[68ch] space-y-4" data-goal-section="progress">
			<h2 className="font-semibold text-xl" id={shellIds.goalProgress} tabIndex={-1}>
				Progress
			</h2>
			{document.metadata.standing ? <p>This goal is a standing home for new work.</p> : null}
			{goal ? <GoalSummary goal={goal} /> : null}
			{goal === undefined && progress.pending ? (
				<Loading className="space-y-3" label="Loading goal progress">
					<Skeleton className="h-4 w-48" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-2/3" />
				</Loading>
			) : null}
			{goal === undefined && !progress.pending ? <p role="status">Progress is available for uniquely identified goals.</p> : null}
			{Option.isSome(progress.cause) && <p role="status">Goal progress refresh failed.</p>}
		</section>
	);
}

function GoalSummary({ goal }: { readonly goal: GoalsProjection["goals"][number] }) {
	const [first, ...rest] = goal.asks;
	const asks = first ? <GoalAsks asks={[first, ...rest]} /> : null;
	if (goal.linked === 0) {
		return (
			<>
				<EmptyState title="No linked work">Work items that name this goal in their Markdown appear here.</EmptyState>
				{asks ? <p>{asks}</p> : null}
			</>
		);
	}
	return (
		<>
			<p>
				{goal.linked} linked {goal.linked === 1 ? "item" : "items"}
				{asks ? <> · {asks}</> : null}
			</p>
			<GoalProgress counts={goal.counts} size="large" title="Linked work" />
			<GoalCountList counts={goal.counts} />
			{goal.lanes?.map((lane) => (
				<section aria-label={lane.title} key={lane.id}>
					<a href={`/_board/item/${lane.id}/`}>{lane.title}</a>
					<GoalProgress counts={lane.counts} title={lane.title} />
					<GoalCountList counts={lane.counts} />
				</section>
			))}
			<GoalBreakdown goal={goal} />
		</>
	);
}

function GoalCountList({ counts }: { readonly counts: GoalCounts }) {
	return (
		<ul aria-label="Linked work by state" className="!p-0 !list-none flex flex-wrap gap-x-5 gap-y-2" data-goal-counts="">
			{goalCountOrder.map((status) => (
				<li className="flex items-center gap-2" data-count={counts[status]} data-status={status} key={status}>
					<span aria-hidden="true" className={`size-2 rounded-full ${counts[status] > 0 ? goalStateColors[status] : "bg-muted-foreground/30"}`} />
					<strong className="tabular-nums">{counts[status]}</strong>{" "}
					{counts[status] > 0 ? (
						<span data-status-token="">{goalStateLabels[status]}</span>
					) : (
						<span className="text-muted-foreground text-xs" data-quiet-count="">
							{goalStateLabels[status]}
						</span>
					)}
				</li>
			))}
		</ul>
	);
}
