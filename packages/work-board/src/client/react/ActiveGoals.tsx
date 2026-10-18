import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { GoalProgress } from "#client/react/GoalProgress.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";

export function ActiveGoals({ api }: { readonly api: ShellApi }) {
	const query = useQuery(api.goals.query(undefined, { timeToLive: 60_000 }), { keepPreviousData: true });
	const goals = Option.getOrUndefined(query.data)?.goals;
	return (
		<>
			{goals?.length === 0 && <p className="px-2 text-muted-foreground text-xs">No active goals.</p>}
			{goals?.map((goal) => (
				<div className="mb-3 px-2" key={goal.id}>
					<a className="block truncate text-sm" href={`/_board/item/${encodeURIComponent(goal.id)}/`}>
						{goal.title}
					</a>
					<GoalProgress compact counts={goal.counts} title={goal.title} />
				</div>
			))}
		</>
	);
}
