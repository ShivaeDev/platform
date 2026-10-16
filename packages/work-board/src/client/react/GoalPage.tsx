import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { Document } from "#browser/document/schema.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { GoalCriteria } from "./GoalCriteria.tsx";
import { GoalWorkTable } from "./GoalWorkTable.tsx";
import { targetsGoal } from "./goalWork.ts";
import type { ShellApi } from "./ShellApi.ts";

export function GoalPage({ api, document }: { readonly api: ShellApi; readonly document: Document }) {
	const progress = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const data = Option.getOrUndefined(progress.data);
	const goal = data?.goals.find((entry) => entry.id === document.identity) ?? data?.closedGoals.find((entry) => entry.id === document.identity);
	const items = data?.items.filter((item) => targetsGoal(item, document.identity ?? ""));
	return (
		<div className="goal-page space-y-6">
			<GoalCriteria document={document} items={items} progress={goal?.criteria} />
			{items ? <GoalWorkTable items={items} /> : <p role="status">{progress.pending ? "Loading linked work…" : "Linked work unavailable."}</p>}
			{Option.isSome(progress.cause) && <p role="status">Linked work refresh failed.</p>}
		</div>
	);
}
