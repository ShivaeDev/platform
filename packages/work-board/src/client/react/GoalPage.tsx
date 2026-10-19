import { Option } from "effect";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { Document } from "#browser/document/schema.ts";
import { GoalCriteria } from "./GoalCriteria.tsx";
import { GoalWorkTable } from "./GoalWorkTable.tsx";
import { targetsGoal } from "./goalWork.ts";
import { LoadingRows } from "./loading.tsx";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

export function GoalPage({ api, document }: { readonly api: ShellApi; readonly document: Document }) {
	const progress = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const data = Option.getOrUndefined(progress.data);
	const id = document.identity;
	const goal = data?.goals.find((entry) => entry.id === id) ?? data?.closedGoals.find((entry) => entry.id === id);
	const items = data?.items.filter((item) => id !== undefined && targetsGoal(item, id));
	const criteria = (document.metadata.criteria ?? []).map((criterion) => criterion.id);
	return (
		<div className="goal-page space-y-6">
			<GoalCriteria document={document} items={items} progress={goal?.criteria} />
			{items && id !== undefined ? <GoalWorkTable criteria={criteria} goal={id} items={items} /> : null}
			{items === undefined && progress.pending ? <LoadingRows label="Loading linked work" /> : null}
			{items === undefined && !progress.pending ? <p role="status">Linked work unavailable.</p> : null}
			{Option.isSome(progress.cause) && <p role="status">Linked work refresh failed.</p>}
		</div>
	);
}
