import { SegmentedBar } from "#client/react/components/ui/SegmentedBar.tsx";
export function GoalProgress({ counts, title }: { readonly counts: Readonly<Record<string, number>>; readonly title: string }) {
	return <SegmentedBar counts={counts} label={`${title}: linked work by status`} />;
}
