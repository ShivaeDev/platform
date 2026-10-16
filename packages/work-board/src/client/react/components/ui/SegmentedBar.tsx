import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
import { StatusSegments } from "./StatusSegments.tsx";

interface Selection {
	readonly label: string;
	readonly onValueChange: (value: string) => void;
	readonly options: readonly { readonly value: string; readonly label: string }[];
	readonly value: string;
}
interface Counts {
	readonly counts: Readonly<Record<string, number>>;
	readonly label: string;
	readonly size?: "small" | "large";
}
export function SegmentedBar(props: Selection | Counts) {
	return "counts" in props ? (
		<StatusSegments counts={props.counts} label={props.label} large={props.size === "large"} />
	) : (
		<SelectionBar {...props} />
	);
}
function SelectionBar({ label, value, options, onValueChange }: Selection) {
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
