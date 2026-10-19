import { SearchIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { WorkProjection } from "#browser/views/schema.ts";
import { fieldFilter, type State, viewUrl } from "#browser/views/state.ts";
import { statusLabel, statusOptions } from "#browser/views/statusLabel.ts";
import { Button, buttonVariants } from "#client/react/components/ui/button.tsx";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#client/react/components/ui/input-group.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#client/react/components/ui/select.tsx";
import { shellIds } from "./shellIds.ts";

const sorts: ReadonlyMap<string, string> = new Map([
	["title", "Title"],
	["kind", "Kind"],
	["status", "Status"],
	["owner", "Owner"],
]);

export function WorkControls({ data }: { readonly data: WorkProjection }) {
	const { state } = data;
	const form = useRef<HTMLFormElement>(null);
	const status = field(data, "status");
	const owner = field(data, "owner");
	const [values, setValues] = useState({ board: state.board, owner: owner.selected, sort: state.sort, status: status.selected });
	function choose(name: keyof typeof values, value: string) {
		flushSync(() => setValues((current) => ({ ...current, [name]: value })));
		form.current?.requestSubmit();
	}
	const boards = new Map(data.boards.map((board) => [board.id, board.title]));
	if (state.board && !data.validBoard) {
		boards.set(state.board, `${state.board} (unavailable)`);
	}
	const filtered = Boolean(state.query || state.status || state.owner);
	return (
		<form action="/_board/work#work-results" className="flex flex-wrap items-center gap-2" id={shellIds.workFilters} method="get" ref={form}>
			<input name="view" type="hidden" value={state.view} />
			<input name="item" type="hidden" value={state.item} />
			{state.order === "desc" && <input name="order" type="hidden" value="desc" />}
			{Object.entries(values).map(([name, value]) => (
				<input key={name} name={name} type="hidden" value={value} />
			))}
			<Label className="sr-only" htmlFor={shellIds.workQuery}>
				Find work
			</Label>
			<InputGroup className="w-full sm:w-64">
				<InputGroupAddon>
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput defaultValue={state.query} id={shellIds.workQuery} maxLength={200} name="q" placeholder="Find work…" type="search" />
			</InputGroup>
			<Filter all="All statuses" id={shellIds.workStatus} label="Status" onChange={(value) => choose("status", value)} options={status.values} value={values.status} />
			<Filter all="All owners" id={shellIds.workOwner} label="Owner" onChange={(value) => choose("owner", value)} options={owner.values} value={values.owner} />
			<Filter all="All work" id={shellIds.workBoard} label="Board" onChange={(value) => choose("board", value)} options={boards} value={values.board} />
			{state.view !== "table" && (
				<Filter id={shellIds.workSort} label="Sort by" onChange={(value) => choose("sort", value)} options={sorts} value={values.sort} />
			)}
			<Button size="sm" type="submit" variant="outline">
				Apply
			</Button>
			{filtered && <ResetLink state={state} />}
		</form>
	);
}

function ResetLink({ state }: { readonly state: State }) {
	return (
		<a className={buttonVariants({ size: "sm", variant: "ghost" })} href={viewUrl(state, { owner: "", query: "", status: "" }, "work-results")}>
			Reset
			<XIcon aria-hidden="true" />
		</a>
	);
}

function field(data: WorkProjection, name: "owner" | "status") {
	function label(value: string) {
		return name === "status" ? statusLabel(value) : value;
	}
	const recorded = data.items.flatMap((item) => (item.metadata[name] ? [item.metadata[name]] : []));
	const values = new Map((name === "status" ? statusOptions(recorded) : recorded).map((value) => [fieldFilter(value), label(value)]));
	const current = data.state[name];
	const shown = current.startsWith("value:") ? label(current.slice(6)) : current;
	const selected = values.has(current)
		? current
		: ([...values].find(([value, text]) => value.startsWith("value:") && text === shown)?.[0] ?? current);
	if (current && !values.has(selected)) {
		values.set(current, `${shown} (no current matches)`);
	}
	return { selected, values: new Map([...values].sort((left, right) => left[1].localeCompare(right[1], "en"))) };
}

function Filter({
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
	const items = [...(all === undefined ? [] : [{ label: all, value: "" }]), ...[...options].map(([option, text]) => ({ label: text, value: option }))];
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
