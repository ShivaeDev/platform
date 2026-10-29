import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { EmptyState } from "./EmptyState.tsx";
import { GoalProgress } from "./GoalProgress.tsx";
import { LinkButton } from "./LinkButton.tsx";

export function TodayGoals({ data }: { readonly data: GoalsProjection }) {
	return data.goals.length > 0 ? (
		<div className="space-y-3">
			{data.goals.map((goal) => (
				<GoalCard goal={goal} key={goal.id} />
			))}
		</div>
	) : (
		<EmptyState action={<LinkButton href="/_board/goals">All goals</LinkButton>} title="No active goals">
			Goals you are working toward appear here with their progress.
		</EmptyState>
	);
}
function GoalCard({ goal }: { readonly goal: GoalsProjection["goals"][number] }) {
	return (
		<article className="today-goal border-border bg-card rounded-lg border p-3" data-goal-id={goal.id}>
			<h3 className="m-0 text-sm font-semibold">
				<a href={`/_board/item/${encodeURIComponent(goal.id)}/`}>{goal.title}</a>
			</h3>
			{goal.nextAction ? (
				<p className="text-muted-foreground m-0 mt-1 line-clamp-2 text-xs" data-goal-next-action="" title={goal.nextAction}>
					{goal.nextAction}
				</p>
			) : null}
			<GoalProgress counts={goal.counts} title={goal.title} />
			<details className="mt-2">
				<summary className="text-muted-foreground cursor-pointer text-xs">Criteria</summary>
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
				<p className="text-muted-foreground m-0 text-xs tabular-nums">
					{criterion.linked} linked · {criterion.evidence} with evidence
				</p>
			</div>
		</li>
	);
}
