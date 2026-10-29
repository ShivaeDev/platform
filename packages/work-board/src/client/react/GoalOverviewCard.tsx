import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { GoalProgress } from "./GoalProgress.tsx";
import { GoalProgressSummary } from "./GoalProgressSummary.tsx";
import { goalTotal } from "./goalCounts.ts";

export function GoalOverviewCard({ goal }: { readonly goal: GoalsProjection["goals"][number] }) {
	const criteria = goal.criteria.filter((criterion) => criterion.linked > 0);
	return (
		<article className="border-border bg-card min-w-0 rounded-lg border p-3" data-goal-id={goal.id}>
			<h2 className="m-0 text-sm font-semibold [overflow-wrap:anywhere]">
				<a href={`/_board/item/${encodeURIComponent(goal.id)}/`}>{goal.title}</a>
			</h2>
			{goal.nextAction ? (
				<p className="text-muted-foreground m-0 mt-1 line-clamp-2 text-xs [overflow-wrap:anywhere]" title={goal.nextAction}>
					{goal.nextAction}
				</p>
			) : null}
			{goal.linked > 0 && <GoalProgress counts={goal.counts} title={goal.title} />}
			<GoalProgressSummary counts={goal.counts} />
			{goal.lanes?.map((lane) => (
				<section aria-label={lane.title} key={lane.id}>
					<a href={`/_board/item/${lane.id}/`}>{lane.title}</a>
					<GoalProgress counts={lane.counts} title={lane.title} />
					<GoalProgressSummary counts={lane.counts} />
				</section>
			))}
			{goal.openAsks > 0 && (
				<p className="text-muted-foreground m-0 mt-2 text-xs">
					{goal.openAsks} open {goal.openAsks === 1 ? "ask" : "asks"}
				</p>
			)}
			{criteria.length > 0 && (
				<ul aria-label={`Criteria for ${goal.title}`} className="m-0 mt-2 list-none space-y-1 p-0 text-xs">
					{criteria.map((criterion) => (
						<CriterionProgress criterion={criterion} goal={goal.id} key={criterion.id} />
					))}
				</ul>
			)}
		</article>
	);
}

function CriterionProgress({ criterion, goal }: { readonly criterion: GoalsProjection["goals"][number]["criteria"][number]; readonly goal: string }) {
	return (
		<li className="flex min-w-0 items-center gap-2">
			<a
				className="text-muted-foreground min-w-0 flex-1 truncate"
				href={`/_board/item/${encodeURIComponent(goal)}/#criterion-${encodeURIComponent(criterion.id)}`}
				title={criterion.text}
			>
				{criterion.text}
			</a>
			<span className="text-muted-foreground shrink-0 tabular-nums" title={`${criterion.counts.done} of ${goalTotal(criterion.counts)} done`}>
				{criterion.counts.done}/{goalTotal(criterion.counts)}
			</span>
		</li>
	);
}
