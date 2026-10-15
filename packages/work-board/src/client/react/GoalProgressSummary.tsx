import { SegmentedBar } from "#client/react/components/ui/SegmentedBar.tsx";

export function GoalProgressSummary({ counts, bar = false }: { readonly counts: Readonly<Record<string, number>>; readonly bar?: boolean }) {
	return bar ? (
		<SegmentedBar counts={counts} label="Linked work progress" />
	) : (
		<p className="text-muted-foreground text-sm" data-criterion-progress>
			{Object.entries(counts)
				.map(([status, count]) => `${count} ${status}`)
				.join(" · ")}
		</p>
	);
}
