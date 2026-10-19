import type { GoalCounts } from "#browser/views/GoalsProjection.ts";
import { goalCountOrder } from "./goalCounts.ts";

export function GoalProgressSummary({ counts }: { readonly counts: GoalCounts }) {
	return (
		<p className="text-muted-foreground text-sm" data-criterion-progress>
			{goalCountOrder
				.filter((key) => counts[key] > 0)
				.map((key) => `${counts[key]} ${key}`)
				.join(" · ")}
		</p>
	);
}
