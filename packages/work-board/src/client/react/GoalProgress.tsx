import { cn } from "cn";
import type { GoalCounts } from "#browser/views/GoalsProjection.ts";
import { goalCountOrder, goalStateColors, goalStateLabels, goalTotal } from "./goalCounts.ts";

export function GoalProgress({
	counts,
	title,
	compact = false,
	size = "small",
}: {
	readonly counts: GoalCounts;
	readonly title: string;
	readonly compact?: boolean;
	readonly size?: "small" | "large";
}) {
	const total = goalTotal(counts);
	const summary = `${counts.done} of ${total} done`;
	const states = goalCountOrder.map((state) => `${counts[state]} ${goalStateLabels[state].toLowerCase()}`).join(", ");
	return (
		<div
			aria-label={`${title}: ${summary}`}
			aria-valuemax={Math.max(total, 1)}
			aria-valuemin={0}
			aria-valuenow={counts.done}
			aria-valuetext={`${summary}, ${states}`}
			className={cn("space-y-1", size === "small" && "mt-2")}
			data-goal-progress=""
			data-slot="progress"
			role="progressbar"
		>
			<div className={cn("flex w-full overflow-hidden rounded-md bg-muted", size === "large" ? "h-2.5" : "h-1.5")} data-slot="progress-track">
				{goalCountOrder.map((state) => (
					<span
						className={cn("h-full", goalStateColors[state])}
						data-count={counts[state]}
						data-goal-state={state}
						key={state}
						style={{ width: `${total === 0 ? 0 : (counts[state] / total) * 100}%` }}
						title={`${goalStateLabels[state]}: ${counts[state]}`}
					/>
				))}
			</div>
			<div className={cn("text-muted-foreground tabular-nums", size === "large" ? "text-sm" : "text-xs")} data-slot="progress-value" title={summary}>
				{compact ? (
					`${counts.done}/${total}`
				) : (
					<>
						<span>
							{counts.done}/{total}
						</span>{" "}
						done
					</>
				)}
			</div>
		</div>
	);
}
