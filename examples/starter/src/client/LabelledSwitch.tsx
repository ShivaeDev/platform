import { Field } from "@base-ui/react/field";
import { Switch } from "#client/ui/switch.tsx";

export function LabelledSwitch({
	label,
	checked,
	disabled = false,
	onCheckedChange,
}: {
	readonly label: string;
	readonly checked: boolean;
	readonly disabled?: boolean;
	readonly onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<Field.Root className="flex flex-wrap items-center gap-2 text-sm" disabled={disabled}>
			<Field.Label className="font-medium">{label}</Field.Label>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
			<span aria-hidden="true" className="text-muted-foreground" data-slot="switch-state">
				{checked ? "On" : "Off"}
			</span>
		</Field.Root>
	);
}
