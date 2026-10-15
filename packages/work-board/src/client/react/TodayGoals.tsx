import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { GoalProgress } from "./GoalProgress.tsx";

export function TodayGoals({ data }: { readonly data: GoalsProjection }) {
	return data.goals.length > 0 ? (
		<div className="space-y-3">
			{data.goals.map((goal) => (
				<GoalCard goal={goal} key={goal.id} />
			))}
		</div>
	) : (
		<p className="text-muted-foreground text-sm">No active goals.</p>
	);
}
function GoalCard({ goal }: { readonly goal: GoalsProjection["goals"][number] }) {
	return (
		<article className="today-goal rounded-lg border border-border bg-card p-3" data-goal-id={goal.id}>
			<h3 className="m-0 font-semibold text-sm">
				<a href={`/_board/item/${encodeURIComponent(goal.id)}/`}>{goal.title}</a>
			</h3>
			{goal.nextAction ? (
				<p className="m-0 mt-1 line-clamp-2 text-muted-foreground text-xs" data-goal-next-action="" title={goal.nextAction}>
					{goal.nextAction}
				</p>
			) : null}
			<GoalProgress counts={goal.counts} title={goal.title} />
			<details className="mt-2">
				<summary className="cursor-pointer text-muted-foreground text-xs">Criteria</summary>
				<ul aria-label={`Criteria for ${goal.title}`} className="m-0 mt-3 list-none space-y-2 p-0 text-sm">
					{goal.criteria.map((criterion) => (
						<CriterionRow criterion={criterion} goal={goal.id} key={criterion.id} />
					))}
				</ul>
			</details>
		</article>
	);
}
function CriterionRow({ criterion, goal }: { readonly criterion: GoalsProjection["goals"][number]["criteria"][number]; readonly goal: string }) {
	return (
		<li className="flex items-start gap-2">
			<span aria-label={criterion.evidence > 0 ? "Evidence recorded" : "No evidence recorded"} className="text-muted-foreground" role="img">
				{criterion.evidence > 0 ? "☑" : "☐"}
			</span>
			<div className="min-w-0">
				<a href={`/_board/item/${encodeURIComponent(goal)}/#criterion-${encodeURIComponent(criterion.id)}`}>{criterion.text}</a>
				<p className="m-0 text-muted-foreground text-xs tabular-nums">
					{criterion.linked} linked · {criterion.evidence} with evidence
				</p>
			</div>
		</li>
	);
}
