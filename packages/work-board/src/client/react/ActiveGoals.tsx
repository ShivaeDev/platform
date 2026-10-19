import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { GoalProgress } from "#client/react/GoalProgress.tsx";
import { LoadingRows } from "#client/react/loading.tsx";
import type { ShellApi } from "#client/react/ShellApi.ts";

export function ActiveGoals({ api }: { readonly api: ShellApi }) {
	const query = useQuery(api.goals.query(undefined, { timeToLive: 60_000 }), { keepPreviousData: true });
	const goals = Option.getOrUndefined(query.data)?.goals;
	return (
		<>
			{goals === undefined && Option.isNone(query.cause) && <LoadingRows framed={false} label="Loading active goals" rows={2} />}
			{goals?.length === 0 && (
				<EmptyState compact title="No active goals">
					Goals you are working toward appear here.
				</EmptyState>
			)}
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
