import { Search } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "#client/react/lib/cn.ts";
import { Button } from "./Button.tsx";
export function Command({
	label,
	items,
	onSelect,
}: {
	readonly label: string;
	readonly items: readonly { readonly value: string; readonly label: string }[];
	readonly onSelect: (value: string) => void;
}) {
	const id = useId();
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
	return (
		<div className="overflow-hidden rounded-lg border bg-popover text-popover-foreground">
			<div className="flex items-center gap-2 border-b px-3">
				<Search aria-hidden="true" className="size-4 text-muted-foreground" />
				<input
					aria-activedescendant={filtered[active] ? `${id}-${active}` : undefined}
					aria-autocomplete="list"
					aria-controls={id}
					aria-expanded="true"
					aria-label={label}
					className="h-10 w-full bg-transparent outline-none"
					onChange={(event) => {
						setQuery(event.target.value);
						setActive(0);
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							setActive((active + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % Math.max(1, filtered.length));
						}
						if (event.key === "Enter" && filtered[active]) {
							onSelect(filtered[active].value);
						}
					}}
					role="combobox"
					value={query}
				/>
			</div>
			<div aria-label={label} className="max-h-72 overflow-y-auto p-1" id={id} role="listbox">
				{filtered.map((item, index) => (
					<Button
						aria-selected={active === index}
						className={cn("w-full justify-start", active === index && "bg-accent")}
						id={`${id}-${index}`}
						key={item.value}
						onClick={() => onSelect(item.value)}
						role="option"
						variant="ghost"
					>
						{item.label}
					</Button>
				))}
				{filtered.length === 0 && <p className="p-3 text-muted-foreground text-sm">No results.</p>}
			</div>
		</div>
	);
}
