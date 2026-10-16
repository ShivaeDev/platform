import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { GoalProgress } from "./GoalProgress.tsx";
export function GoalsPage({ data }: { readonly data: GoalsProjection }) {
	return (
		<div className="mx-auto max-w-5xl p-6">
			<h1>Goals</h1>
			{data.goals.length === 0 && <p>No active goals.</p>}
			{data.goals.map((goal) => (
				<section className="my-6 rounded-lg border p-4" key={goal.id}>
					<h2>
						<a href={`/_board/item/${encodeURIComponent(goal.id)}/`}>{goal.title}</a>
					</h2>
					<GoalProgress counts={goal.counts} title={goal.title} />
					<p>
						{goal.linked} linked work · {goal.openAsks} open {goal.openAsks === 1 ? "ask" : "asks"}
					</p>
					{goal.criteria.map((criterion) => (
						<p key={criterion.id}>
							{criterion.text} · {criterion.linked} linked work · {criterion.evidence} evidence claims
						</p>
					))}
				</section>
			))}
		</div>
	);
}
