import { useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { CriterionClaims } from "./DocumentCriteria.tsx";
import { GoalProgressSummary } from "./GoalProgressSummary.tsx";
import { GoalWorkLink, GoalWorkStatus } from "./GoalWorkTable.tsx";
import { type GoalWorkItem, targetsGoal } from "./goalWork.ts";
import { keyed } from "./keyed.ts";

interface Props {
	readonly document: Document;
	readonly items: readonly GoalWorkItem[] | undefined;
	readonly progress: GoalsProjection["goals"][number]["criteria"] | undefined;
}
export function GoalCriteria({ document, items, progress }: Props) {
	const headingId = useId();
	const criteria = document.metadata.criteria ?? [];
	return (
		<section aria-labelledby={headingId} data-goal-section="criteria">
			<h2 id={headingId}>Criteria and recorded evidence</h2>
			{criteria.length === 0 && <p>No criteria recorded.</p>}
			{keyed(criteria, (criterion) => criterion.id).map(({ key, index }) => (
				<Criterion document={document} index={index} items={items} key={key} progress={progress} />
			))}
		</section>
	);
}
function Criterion({ document, items, index, progress }: Props & { readonly index: number }) {
	const criteria = document.metadata.criteria ?? [];
	const criterion = criteria[index];
	if (!criterion) {
		return null;
	}
	const unique = criteria.filter((entry) => entry.id === criterion.id).length === 1;
	const counts = progress?.find((entry) => entry.id === criterion.id)?.counts;
	const work = items?.filter((item) => targetsGoal(item, document.identity ?? "", criterion.id));
	return (
		<section className="rounded-lg border p-4" id={unique ? `criterion-${criterion.id}` : undefined} tabIndex={-1}>
			<h3 className="!mt-0">{criterion.text}</h3>
			{counts && Object.values(counts).some((count) => count > 0) && <GoalProgressSummary counts={counts} />}
			<LinkedItems items={work} />
			<CriterionClaims document={document} id={criterion.id} valid={Boolean(document.identity) && document.unavailable.length === 0 && unique} />
		</section>
	);
}
function LinkedItems({ items }: { readonly items: readonly GoalWorkItem[] | undefined }) {
	if (!items) {
		return <p>Linked work unavailable.</p>;
	}
	return items.length === 0 ? null : (
		<ul>
			{items.map((item) => (
				<li key={item.id}>
					<GoalWorkLink item={item} /> <GoalWorkStatus item={item} />
				</li>
			))}
		</ul>
	);
}
