import type { GoalCounts } from "#browser/views/GoalsProjection.ts";
import { goalCountOrder, goalStateLabels } from "./goalCounts.ts";

export function GoalProgressSummary({ counts }: { readonly counts: GoalCounts }) {
	return (
		<p className="text-muted-foreground !m-0 text-xs" data-criterion-progress>
			{goalCountOrder
				.filter((key) => counts[key] > 0)
				.map((key) => `${counts[key]} ${goalStateLabels[key].toLowerCase()}`)
				.join(" · ")}
		</p>
	);
}
