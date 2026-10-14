import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
import { StatusSegments } from "./StatusSegments.tsx";

interface Controls {
	readonly label: string;
	readonly onValueChange: (value: string) => void;
	readonly options: readonly { readonly value: string; readonly label: string }[];
	readonly value: string;
}
export function SegmentedBar(props: Controls | { readonly label: string; readonly counts: Readonly<Record<string, number>> }) {
	if ("counts" in props) {
		return <StatusSegments counts={props.counts} label={props.label} />;
	}
	return <SegmentedControls {...props} />;
}
function SegmentedControls({ label, value, options, onValueChange }: Controls) {
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
