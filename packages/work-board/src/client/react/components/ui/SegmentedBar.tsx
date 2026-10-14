import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
export function SegmentedBar({
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
