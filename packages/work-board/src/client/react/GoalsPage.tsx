import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { GoalOverviewCard } from "./GoalOverviewCard.tsx";

export function GoalsPage({ data }: { readonly data: GoalsProjection }) {
	return (
		<div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
			<h1 className="m-0 font-semibold text-2xl">Goals</h1>
			{data.goals.length === 0 && <p className="text-muted-foreground text-sm">No active goals.</p>}
			<GoalCards goals={data.goals} />
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

function GoalCards({ goals }: { readonly goals: GoalsProjection["goals"] }) {
	return (
		<div className="grid min-w-0 gap-3 md:grid-cols-2">
			{goals.map((goal) => (
				<GoalOverviewCard goal={goal} key={goal.id} />
			))}
		</div>
	);
}
