import { Option } from "effect";
import { useId, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { Checkbox } from "#client/react/components/ui/checkbox.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#client/react/components/ui/select.tsx";
import { ToggleGroup, ToggleGroupItem } from "#client/react/components/ui/toggle-group.tsx";
import { LibraryContents } from "./LibraryContents.tsx";
import { routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";

export function LibraryPage({ api, url = "/_board/library" }: { readonly api: ShellApi; readonly url?: string }) {
	const [kind, setKind] = useState("");
	const [status, setStatus] = useState("");
	const [showFleet, setShowFleet] = useState(false);
	const [view, setView] = useState(new URL(url, "http://localhost").searchParams.get("view") === "recently-changed" ? "recently changed" : "titles");
	const filters = { ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(showFleet ? { showFleet } : {}) };
	const query = useQuery(api.library.query({ ...filters, ...(view === "folders" ? { folder: "" } : {}) }, routeQueryOptions), {
		keepPreviousData: true,
	});
	const data = Option.getOrUndefined(query.data);
	const fleetId = useId();
	return (
		<div className="mx-auto max-w-5xl p-4 md:p-8">
			<h1>Library</h1>
			<p className="text-muted-foreground">Every document in your workspace.</p>
			<div className="my-6 flex flex-wrap items-end gap-4">
				<Filter label="Kind" onChange={setKind} options={data?.kinds ?? []} value={kind} />
				<Filter label="Status" onChange={setStatus} options={data?.statuses ?? []} value={status} />
				<ViewToggle onChange={setView} view={view} />
				<div className="flex h-7 items-center gap-2">
					<Checkbox checked={showFleet} id={fleetId} onCheckedChange={setShowFleet} />
					<Label htmlFor={fleetId}>Show Fleet records ({data?.fleetCount ?? 0})</Label>
				</div>
			</div>
			{query.pending ? <p role="status">Loading Library…</p> : null}
			{Option.isSome(query.cause) && <p role="alert">Library refresh failed. Try again.</p>}
			{data ? <LibraryContents api={api} data={data} filters={filters} view={view} /> : null}
		</div>
	);
}

function ViewToggle({ view, onChange }: { readonly view: string; readonly onChange: (view: string) => void }) {
	const labelId = useId();
	return (
		<div className="grid gap-2">
			<span className="font-medium text-xs leading-none" id={labelId}>
				View
			</span>
			<ToggleGroup aria-labelledby={labelId} onValueChange={([next]) => next && onChange(next)} spacing={0} value={[view]} variant="outline">
				{views.map(([value, label]) => (
					<ToggleGroupItem key={value} value={value}>
						{label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

const views = [
	["titles", "Titles"],
	["folders", "Folders"],
	["recently changed", "Recently changed"],
] as const;

function Filter({
	label,
	options,
	value,
	onChange,
}: {
	readonly label: string;
	readonly options: readonly string[];
	readonly value: string;
	readonly onChange: (value: string) => void;
}) {
	const id = useId();
	return (
		<div className="grid gap-2">
			<Label htmlFor={id}>{label}</Label>
			<Select
				items={[{ label: "All", value: null }, ...options.map((option) => ({ label: option, value: option }))]}
				onValueChange={(next) => onChange(next ?? "")}
				value={value || null}
			>
				<SelectTrigger className="min-w-32" id={id}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={null}>All</SelectItem>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
