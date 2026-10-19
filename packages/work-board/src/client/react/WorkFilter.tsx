import { Label } from "#client/react/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#client/react/components/ui/select.tsx";

export function WorkFilter({
	all,
	id,
	label,
	options,
	value,
	onChange,
}: {
	readonly all?: string;
	readonly id: string;
	readonly label: string;
	readonly options: ReadonlyMap<string, string>;
	readonly value: string;
	readonly onChange: (value: string) => void;
}) {
	const items = [
		...(all === undefined ? [] : [{ label: all, value: "" }]),
		...[...options].map(([option, text]) => ({ label: text, value: option })),
	];
	return (
		<>
			<Label className="sr-only" htmlFor={id}>
				{label}
			</Label>
			<Select items={items} onValueChange={(next) => onChange(next ?? "")} value={value}>
				<SelectTrigger className="max-w-full" id={id}>
					<span className="text-muted-foreground">{label}</span>
					<SelectValue className="font-medium" />
				</SelectTrigger>
				<SelectContent>
					{items.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</>
	);
}
