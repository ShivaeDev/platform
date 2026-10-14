import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
export function SegmentedBar(
	props: { readonly counts: Readonly<Record<string, number>>; readonly label: string } | Parameters<typeof SegmentedControl>[0],
) {
	if (!("counts" in props)) {
		return <SegmentedControl {...props} />;
	}
	const total = Object.values(props.counts).reduce((sum, count) => sum + count, 0);
	const description = Object.entries(props.counts)
		.map(([status, count]) => `${status}: ${count}`)
		.join(", ");
	return (
		<div
			aria-label={`${props.label}: ${description || "No linked work"}`}
			className="my-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
			role="img"
			title={description || "No linked work"}
		>
			{Object.entries(props.counts).map(([status, count]) => (
				<span className={segmentColor(status)} key={status} style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
			))}
		</div>
	);
}
function segmentColor(status: string) {
	if (["done", "completed", "accepted"].includes(status)) {
		return "bg-done";
	}
	if (["blocked", "needs-human"].includes(status)) {
		return "bg-blocked";
	}
	if (["active", "in-progress", "running"].includes(status)) {
		return "bg-agent-working";
	}
	return "bg-deferred";
}
function SegmentedControl({
	label,
	value,
	options,
	onValueChange,
}: {
	readonly label: string;
	readonly value: string;
	readonly options: readonly { readonly value: string; readonly label: string }[];
	readonly onValueChange: (value: string) => void;
}) {
	return (
		<fieldset aria-label={label} className="inline-flex gap-1 rounded-lg bg-muted p-1">
			{options.map((option) => (
				<Button
					aria-pressed={value === option.value}
					className={cn(value === option.value && "bg-background shadow-sm")}
					key={option.value}
					onClick={() => onValueChange(option.value)}
					size="sm"
					variant="ghost"
				>
					{option.label}
				</Button>
			))}
		</fieldset>
	);
}
