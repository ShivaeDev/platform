import { SegmentedBar } from "#client/react/SegmentedBar.tsx";
export function GoalProgress({
	counts,
	title,
	compact = false,
}: {
	readonly counts: Readonly<Record<string, number>>;
	readonly title: string;
	readonly compact?: boolean;
}) {
	const grouped = { done: 0, "in progress": 0, planned: 0 };
	for (const [status, count] of Object.entries(counts)) {
		if (["done", "completed", "accepted"].includes(status)) {
			grouped.done += count;
		} else if (
			[
				"active",
				"running",
				"in-progress",
				"in progress",
				"agent-working",
				"blocked",
				"needs-human",
				"executing",
				"reviewing",
				"repairing",
				"adopting",
			].includes(status)
		) {
			grouped["in progress"] += count;
		} else {
			grouped.planned += count;
		}
	}
	const total = grouped.done + grouped["in progress"] + grouped.planned;
	const amount = compact ? `${grouped.done}/${total}` : `${grouped.done} of ${total} done`;
	return (
		<div className="mt-2 space-y-1">
			<SegmentedBar counts={grouped} label={`${title}: ${grouped.done} of ${total} done`} />
			<p className="m-0 text-muted-foreground text-xs tabular-nums" title={`${grouped.done} of ${total} done`}>
				{amount}
			</p>
		</div>
	);
}
