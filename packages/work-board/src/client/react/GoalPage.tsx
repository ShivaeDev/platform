import { Option } from "effect";
import { useId } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { Document } from "#browser/document/schema.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import { GoalCriteria } from "./GoalCriteria.tsx";
import { GoalProgressSummary } from "./GoalProgressSummary.tsx";
import { GoalWorkTable } from "./GoalWorkTable.tsx";
import { targetsGoal } from "./goalWork.ts";
import type { ShellApi } from "./ShellApi.ts";

export function GoalPage({ api, document }: { readonly api: ShellApi; readonly document: Document }) {
	const headingId = useId();
	const progress = useQuery(api.goals.query(undefined, routeQueryOptions), { keepPreviousData: true });
	const work = useQuery(api.work.query({ url: "/_board/work" }, routeQueryOptions), { keepPreviousData: true });
	const goal = Option.getOrUndefined(progress.data)?.goals.find((entry) => entry.id === document.identity);
	const data = Option.getOrUndefined(work.data);
	const items = data ? [...data.items, ...data.boards].filter((item) => targetsGoal(item, document.identity ?? "")) : undefined;
	return (
		<div className="goal-page space-y-6">
			<section aria-labelledby={headingId} data-goal-section="progress">
				<h2 className="!mt-0" id={headingId}>
					Progress
				</h2>
				{goal ? (
					<>
						<p>{goal.linked} linked items</p>
						{items ? <GoalProgressSummary bar items={items} /> : <p role="status">Loading linked work progress…</p>}
					</>
				) : (
					<p role="status">{progress.pending ? "Loading goal progress…" : "Progress is available for uniquely identified open projects."}</p>
				)}
				{Option.isSome(progress.cause) && <p role="status">Goal progress refresh failed.</p>}
			</section>
			<GoalCriteria document={document} items={items} />
			{items ? <GoalWorkTable items={items} /> : <p role="status">{work.pending ? "Loading linked work…" : "Linked work unavailable."}</p>}
			{Option.isSome(work.cause) && <p role="status">Linked work refresh failed.</p>}
		</div>
	);
}
