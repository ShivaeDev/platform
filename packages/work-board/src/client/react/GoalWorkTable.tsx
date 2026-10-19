import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useContext } from "react";
import { goalWorkGroups } from "#browser/views/goalWorkState.ts";
import { buttonVariants } from "#client/react/components/ui/button.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#client/react/components/ui/collapsible.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { GoalWorkGroup } from "./GoalWorkGroup.tsx";
import { type GoalWorkItem, goalGroup, goalRun } from "./goalWork.ts";
import { shellIds } from "./shellIds.ts";

const QUIET_GROUPS: ReadonlySet<string> = new Set(["Planned", "Done"]);
interface Props {
	readonly criteria: readonly string[];
	readonly goal: string;
	readonly items: readonly GoalWorkItem[];
}
export function GoalWorkTable({ criteria, goal, items }: Props) {
	const fleet = useContext(FleetItemsContext);
	if (items.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby={shellIds.goalLinkedWork} data-goal-section="work">
			<h2 id={shellIds.goalLinkedWork} tabIndex={-1}>
				Linked work
			</h2>
			{goalWorkGroups.map((group) => {
				const work = items.filter((item) => goalGroup(item, goalRun(item, fleet)) === group);
				return work.length === 0 ? null : (
					<GroupSection count={work.length} group={group} key={group}>
						<GoalWorkGroup criteria={criteria} goal={goal} group={group} items={work} />
					</GroupSection>
				);
			})}
		</section>
	);
}
function GroupSection({ children, count, group }: { readonly children: ReactNode; readonly count: number; readonly group: string }) {
	if (!QUIET_GROUPS.has(group)) {
		return (
			<section data-goal-group={group}>
				<h3>
					{group} ({count})
				</h3>
				{children}
			</section>
		);
	}
	return (
		<Collapsible className="group/work" data-goal-group={group}>
			<h3>
				<CollapsibleTrigger className={cn(buttonVariants({ variant: "ghost" }), "-ml-2 font-semibold text-base")}>
					<ChevronRight aria-hidden="true" className="transition-transform group-data-open/work:rotate-90" />
					{group} ({count})
				</CollapsibleTrigger>
			</h3>
			<CollapsibleContent hiddenUntilFound>{children}</CollapsibleContent>
		</Collapsible>
	);
}
