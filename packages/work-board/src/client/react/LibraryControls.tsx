import { SearchIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type Library, type LibraryState, libraryUrl } from "#browser/navigation/library.ts";
import { kindLabel, statusLabel } from "#browser/views/statusLabel.ts";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { Checkbox } from "#client/react/components/ui/checkbox.tsx";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#client/react/components/ui/input-group.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { ToggleGroup, ToggleGroupItem } from "#client/react/components/ui/toggle-group.tsx";
import { shellIds } from "./shellIds.ts";
import { WorkFilter } from "./WorkFilter.tsx";

const views = [
	["recently-changed", "Recently changed"],
	["titles", "By title"],
	["folders", "By folder"],
] as const;

export function LibraryControls({ data, state }: { readonly data: Library; readonly state: LibraryState }) {
	const formRef = useRef<HTMLFormElement>(null);
	const fleetId = useId();
	const [values, setValues] = useState({ fleet: state.fleet ? "1" : "", kind: state.kind, status: state.status, view: state.view });
	function choose(name: keyof typeof values, value: string) {
		flushSync(() => setValues((current) => ({ ...current, [name]: value })));
		formRef.current?.requestSubmit();
	}
	return (
		<form action="/_board/library" className="my-6 grid gap-3" id={shellIds.libraryFilters} method="get" ref={formRef}>
			{Object.entries(values).map(([name, value]) => (
				<input key={name} name={name} type="hidden" value={value} />
			))}
			<div className="flex flex-wrap items-center gap-2">
				<Label className="sr-only" htmlFor={shellIds.libraryQuery}>
					Find documents
				</Label>
				<InputGroup className="w-full sm:w-64">
					<InputGroupAddon>
						<SearchIcon aria-hidden="true" />
					</InputGroupAddon>
					<InputGroupInput
						defaultValue={state.query}
						id={shellIds.libraryQuery}
						maxLength={200}
						name="q"
						placeholder="Find documents…"
						type="search"
					/>
				</InputGroup>
				<WorkFilter
					all="All kinds"
					id={shellIds.libraryKind}
					label="Kind"
					onChange={(value) => choose("kind", value)}
					{...choices(data.kinds, values.kind, kindLabel)}
				/>
				<WorkFilter
					all="All statuses"
					id={shellIds.libraryStatus}
					label="Status"
					onChange={(value) => choose("status", value)}
					{...choices(data.statuses, values.status, statusLabel)}
				/>
				<Button size="sm" type="submit" variant="outline">
					Apply
				</Button>
				{Boolean(state.kind || state.status || state.query) && (
					<a className={buttonVariants({ size: "sm", variant: "ghost" })} href={libraryUrl(state, { kind: "", query: "", status: "" })}>
						Reset
						<XIcon aria-hidden="true" />
					</a>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<ToggleGroup aria-label="View" onValueChange={([next]) => next && choose("view", next)} spacing={0} value={[values.view]} variant="outline">
					{views.map(([value, label]) => (
						<ToggleGroupItem key={value} value={value}>
							{label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<div className="flex h-7 items-center gap-2">
					<Checkbox checked={values.fleet === "1"} id={fleetId} onCheckedChange={(checked) => choose("fleet", checked ? "1" : "")} />
					<Label htmlFor={fleetId}>Include files Fleet writes ({data.fleetCount})</Label>
				</div>
			</div>
		</form>
	);
}

function choices(options: readonly string[], current: string, label: (option: string) => string) {
	const known = new Map(options.map((option) => [option, label(option)]));
	const match = known.has(current) ? current : [...known].find(([, text]) => current && text === label(current))?.[0];
	return current && match === undefined
		? { options: new Map([...known, [current, `${label(current)} (no current matches)`]]), value: current }
		: { options: known, value: match ?? "" };
}
