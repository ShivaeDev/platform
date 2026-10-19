import { cn } from "cn";
import type { GoalCounts } from "#browser/views/GoalsProjection.ts";
import { Progress, ProgressLabel, ProgressValue } from "#client/react/components/ui/progress.tsx";
import { goalTotal } from "./goalCounts.ts";

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
	const large = size === "large";
	return (
		<Progress
			aria-label={`${title}: ${summary}`}
			className={cn(
				"[&_[data-slot=progress-indicator]]:bg-done",
				large ? "gap-2 text-sm [&_[data-slot=progress-track]]:h-2.5" : "mt-2 gap-1 [&_[data-slot=progress-track]]:h-1.5",
			)}
			data-goal-progress=""
			getAriaValueText={() => summary}
			max={Math.max(total, 1)}
			value={counts.done}
		>
			{large ? <ProgressLabel className="text-sm">Done</ProgressLabel> : null}
			<ProgressValue className={cn("tabular-nums", large ? "text-sm" : "order-last ml-0")} title={summary}>
				{() => (compact ? `${counts.done}/${total}` : summary)}
			</ProgressValue>
		</Progress>
	);
}
