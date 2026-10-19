import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { buttonVariants } from "#client/react/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "#client/react/components/ui/card.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#client/react/components/ui/collapsible.tsx";
import { CriterionClaims } from "./DocumentCriteria.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { GoalProgressSummary } from "./GoalProgressSummary.tsx";
import { GoalWorkLink, GoalWorkStatus } from "./GoalWorkStatus.tsx";
import { type GoalWorkItem, targetsGoal } from "./goalWork.ts";
import { keyed } from "./keyed.ts";
import { LazyInlineMarkdown } from "./lazyMarkdown.tsx";

interface Props {
	readonly document: Document;
	readonly items: readonly GoalWorkItem[] | undefined;
	readonly progress: GoalsProjection["goals"][number]["criteria"] | undefined;
}
export function GoalCriteria({ document, items, progress }: Props) {
	const headingId = useId();
	const criteria = document.metadata.criteria ?? [];
	return (
		<section aria-labelledby={headingId} className="space-y-3" data-goal-section="criteria">
			<h2 id={headingId}>Criteria and recorded evidence</h2>
			{criteria.length === 0 && (
				<EmptyState title="No criteria">This goal lists no criteria yet. Add them to the goal file to track evidence for each one.</EmptyState>
			)}
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
		<Card
			className="scroll-mt-24 text-sm"
			data-criterion={criterion.id}
			id={unique ? `criterion-${criterion.id}` : undefined}
			size="sm"
			tabIndex={-1}
		>
			<CardHeader>
				<CardTitle className="font-normal text-sm">
					<LazyInlineMarkdown document={document} source={criterion.text} />
				</CardTitle>
				{counts && Object.values(counts).some((count) => count > 0) && <GoalProgressSummary counts={counts} />}
			</CardHeader>
			<CardContent className="empty:hidden">
				<LinkedItems items={work} />
				<CriterionClaims document={document} id={criterion.id} valid={Boolean(document.identity) && document.unavailable.length === 0 && unique} />
			</CardContent>
		</Card>
	);
}
function LinkedItems({ items }: { readonly items: readonly GoalWorkItem[] | undefined }) {
	if (!items) {
		return <p>Linked work unavailable.</p>;
	}
	return items.length === 0 ? null : (
		<Collapsible className="group/linked">
			<CollapsibleTrigger className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "-ml-2")}>
				<ChevronRight aria-hidden="true" className="transition-transform group-data-open/linked:rotate-90" />
				{items.length} linked {items.length === 1 ? "item" : "items"}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="!mt-1 !mb-0" data-criterion-work="">
					{items.map((item) => (
						<li key={item.id}>
							<GoalWorkLink item={item} /> <GoalWorkStatus item={item} />
						</li>
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}
