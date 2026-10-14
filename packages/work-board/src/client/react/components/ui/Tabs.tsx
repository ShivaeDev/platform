import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
export function Tabs({
	label,
	value,
	tabs,
	onValueChange,
}: {
	readonly label: string;
	readonly value: string;
	readonly tabs: readonly { readonly value: string; readonly label: string; readonly content: ReactNode }[];
	readonly onValueChange: (value: string) => void;
}) {
	const id = useId();
	function move(event: React.KeyboardEvent, index: number) {
		let offset = 0;
		if (event.key === "ArrowRight") {
			offset = 1;
		}
		if (event.key === "ArrowLeft") {
			offset = -1;
		}
		if (!offset) {
			return;
		}
		event.preventDefault();
		const next = (index + offset + tabs.length) % tabs.length;
		const selected = tabs[next];
		if (selected) {
			onValueChange(selected.value);
			document.getElementById(`${id}-tab-${next}`)?.focus();
		}
	}
	return (
		<div>
			<div aria-label={label} className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
				{tabs.map((tab, index) => (
					<Button
						aria-controls={`${id}-panel-${index}`}
						aria-selected={value === tab.value}
						className={cn(value === tab.value && "bg-background shadow-sm")}
						id={`${id}-tab-${index}`}
						key={tab.value}
						onClick={() => onValueChange(tab.value)}
						onKeyDown={(event) => move(event, index)}
						role="tab"
						tabIndex={value === tab.value ? 0 : -1}
						variant="ghost"
					>
						{tab.label}
					</Button>
				))}
			</div>
			{tabs.map((tab, index) => (
				<div
					aria-labelledby={`${id}-tab-${index}`}
					className="pt-4"
					hidden={value !== tab.value}
					id={`${id}-panel-${index}`}
					key={tab.value}
					role="tabpanel"
				>
					{tab.content}
				</div>
			))}
		</div>
	);
}
