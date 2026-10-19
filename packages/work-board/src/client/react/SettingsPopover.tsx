import { Settings } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Button } from "#client/react/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#client/react/components/ui/popover.tsx";
import { Separator } from "#client/react/components/ui/separator.tsx";
import { ToggleGroup, ToggleGroupItem } from "#client/react/components/ui/toggle-group.tsx";
import { shellIds } from "./shellIds.ts";
import type { AppearanceControls } from "./useAppearance.ts";

const themes = [
	{ label: "System", value: "system" },
	{ label: "Light", value: "light" },
	{ label: "Dark", value: "dark" },
];
const densities = [
	{ label: "Comfortable", value: "comfortable" },
	{ label: "Compact", value: "compact" },
];

export function SettingsPopover({ appearance, updates }: { readonly appearance: AppearanceControls; readonly updates: ReactNode }) {
	return (
		<Popover>
			<PopoverTrigger
				render={<Button aria-label="Settings" className="shrink-0" id={shellIds.settingsOpen} size="icon" type="button" variant="ghost" />}
			>
				<Settings aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent align="end" aria-label="Settings" className="max-w-[calc(100vw-2rem)] text-sm">
				<div className="grid gap-4">
					<h2 className="font-semibold">Settings</h2>
					<Choice label="Theme" onChange={(theme) => appearance.change({ theme })} options={themes} value={appearance.theme} />
					<Choice label="Density" onChange={(density) => appearance.change({ density })} options={densities} value={appearance.density} />
					<Separator />
					{updates}
					<span className="text-muted-foreground text-xs empty:hidden" id={shellIds.preferenceStatus} role="status">
						{appearance.notice}
					</span>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function Choice({
	label,
	options,
	value,
	onChange,
}: {
	readonly label: string;
	readonly options: ReadonlyArray<{ readonly label: string; readonly value: string }>;
	readonly value: string;
	readonly onChange: (value: string) => void;
}) {
	const id = useId();
	return (
		<div className="grid gap-1.5">
			<span className="text-muted-foreground text-xs" id={id}>
				{label}
			</span>
			<ToggleGroup
				aria-labelledby={id}
				className="w-full"
				onValueChange={([next]) => {
					if (next !== undefined) {
						onChange(next);
					}
				}}
				spacing={0}
				value={[value]}
				variant="outline"
			>
				{options.map((option) => (
					<ToggleGroupItem className="flex-1" key={option.value} value={option.value}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}
