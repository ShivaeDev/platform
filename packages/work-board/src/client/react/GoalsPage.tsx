import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { GoalOverviewCard } from "./GoalOverviewCard.tsx";
import { PageHeader } from "./PageHeader.tsx";

export function GoalsPage({ data }: { readonly data: GoalsProjection }) {
	return (
		<div className="max-w-5xl space-y-6">
			<PageHeader summary={goalsSummary(data)} title="Goals" />
			<GoalCards goals={data.goals} />
			{data.deferredGoals.length > 0 && (
				<details>
					<summary className="cursor-pointer text-muted-foreground text-sm">Deferred goals</summary>
					<div className="mt-3">
						<GoalCards goals={data.deferredGoals} />
					</div>
				</details>
			)}
			{data.closedGoals.length > 0 && (
				<details>
					<summary className="cursor-pointer text-muted-foreground text-sm">Closed goals</summary>
					<div className="mt-3">
						<GoalCards goals={data.closedGoals} />
					</div>
				</details>
			)}
		</div>
	);
}

function goalsSummary(data: GoalsProjection) {
	const count = data.goals.length;
	return count === 0 ? "No active goals." : `${count} active ${count === 1 ? "goal" : "goals"}`;
}

function GoalCards({ goals }: { readonly goals: GoalsProjection["goals"] }) {
	return (
		<div className="grid min-w-0 items-start gap-3 md:grid-cols-2">
			{goals.map((goal) => (
				<GoalOverviewCard goal={goal} key={goal.id} />
			))}
		</div>
	);
}
