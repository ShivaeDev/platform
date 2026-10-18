import { Option } from "effect";
import { useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
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
	return (
		<div className="mx-auto max-w-5xl p-4 md:p-8">
			<h1>Library</h1>
			<p className="text-muted-foreground">Every document in your workspace.</p>
			<div className="my-6 flex flex-wrap items-end gap-4">
				<Filter label="Kind" onChange={setKind} options={data?.kinds ?? []} value={kind} />
				<Filter label="Status" onChange={setStatus} options={data?.statuses ?? []} value={status} />
				<Filter label="View" onChange={setView} options={["titles", "folders", "recently changed"]} value={view} />
				<label className="flex items-center gap-2 text-sm">
					<input checked={showFleet} onChange={(event) => setShowFleet(event.target.checked)} type="checkbox" />
					Show Fleet records ({data?.fleetCount ?? 0})
				</label>
			</div>
			{query.pending ? <p role="status">Loading Library…</p> : null}
			{Option.isSome(query.cause) && <p role="alert">Library refresh failed. Try again.</p>}
			{data ? <LibraryContents api={api} data={data} filters={filters} view={view} /> : null}
		</div>
	);
}
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
	return (
		<label className="grid gap-1 text-sm">
			{label}
			<select aria-label={label} className="rounded-md border bg-background p-2" onChange={(event) => onChange(event.target.value)} value={value}>
				{label !== "View" && <option value="">All</option>}
				{options.map((option) => (
					<option key={option} value={option}>
						{viewLabel(option)}
					</option>
				))}
			</select>
		</label>
	);
}

function viewLabel(value: string) {
	if (value === "recently changed") {
		return "Recently changed";
	}
	if (value === "folders") {
		return "Folders";
	}
	if (value === "titles") {
		return "Titles";
	}
	return value;
}
