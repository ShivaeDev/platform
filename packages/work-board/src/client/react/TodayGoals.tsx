import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { SegmentedBar } from "#client/react/components/ui/SegmentedBar.tsx";

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
		<article className="today-goal rounded-lg border border-border bg-card p-4" data-goal-id={goal.id}>
			<h3 className="m-0 font-semibold text-base">
				<a href={`/_board/item/${encodeURIComponent(goal.id)}/`}>{goal.title}</a>
			</h3>
			<p className="my-2 line-clamp-2 text-muted-foreground text-sm">{goal.nextAction ?? "Next action not recorded"}</p>
			<SegmentedBar counts={goal.counts} label={`Linked items for ${goal.title}`} />
			<ul aria-label={`Criteria for ${goal.title}`} className="m-0 mt-3 list-none space-y-2 p-0 text-sm">
				{goal.criteria.map((criterion) => (
					<CriterionRow criterion={criterion} goal={goal.id} key={criterion.id} />
				))}
			</ul>
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
					{criterion.linked > 0 ? `${criterion.linked} linked · ${criterion.evidence} with evidence` : "not linked"}
				</p>
			</div>
		</li>
	);
}
