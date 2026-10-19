import { createColumnHelper, type Header, rowSortingFeature, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo } from "react";
import type { WorkProjection } from "#browser/views/schema.ts";
import { type State, viewUrl } from "#browser/views/state.ts";
import { buttonVariants } from "#client/react/components/ui/button.tsx";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "#client/react/components/ui/table.tsx";
import { useVirtualRows } from "./useVirtualRows.ts";
import { WorkTableRow } from "./WorkTableRow.tsx";

type WorkRow = WorkProjection["rows"][number];
const ROW_HEIGHT = 64;
const features = tableFeatures({ rowSortingFeature });
const column = createColumnHelper<typeof features, WorkRow>();
const columns = column.columns([
	column.accessor("title", { header: "Work" }),
	column.accessor("metadata.kind", { header: "Kind", id: "kind" }),
	column.accessor("metadata.status", { header: "Status", id: "status" }),
	column.accessor("metadata.owner", { header: "Owner", id: "owner" }),
	column.accessor("metadata.nextAction", { enableSorting: false, header: "Next action", id: "nextAction" }),
]);
const widths: Readonly<Record<string, string>> = {
	kind: "w-[8%] max-md:hidden",
	nextAction: "w-[30%] max-md:hidden",
	owner: "w-[11%] max-md:hidden",
	status: "w-[15%] max-md:w-[38%]",
	title: "w-[36%] max-md:w-[62%]",
};
const sortIcons = { asc: ArrowUp, desc: ArrowDown } as const;
const ariaSorts = { asc: "ascending", desc: "descending" } as const;

export function WorkTable({ data }: { readonly data: WorkProjection }) {
	const { state } = data;
	const sorting = useMemo(() => [{ desc: state.order === "desc", id: state.sort }], [state.order, state.sort]);
	const table = useTable({ columns, data: data.rows, features, manualSorting: true, state: { sorting } });
	const rows = table.getRowModel().rows;
	const window = useVirtualRows<HTMLDivElement>(rows.length, ROW_HEIGHT);
	const virtual = rows.length > 200;
	return (
		// The fixed layout never needs a horizontal scroller, so the header can stick below the workspace header while the page scrolls.
		<div className="overflow-clip rounded-lg border bg-card [&>[data-slot=table-container]]:overflow-visible" ref={window.ref}>
			<Table className="table-fixed text-sm">
				<TableCaption className="sr-only">
					Identified work, sorted by {state.sort} {state.order === "desc" ? "descending" : "ascending"}
				</TableCaption>
				<TableHeader className="sticky top-(--board-header-height) z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-0">
					{table.getHeaderGroups().map((group) => (
						<HeaderRow headers={group.headers} key={group.id} state={state} />
					))}
				</TableHeader>
				<TableBody>
					{window.top > 0 && (
						<tr>
							<td colSpan={columns.length} style={{ height: window.top, padding: 0 }} />
						</tr>
					)}
					{rows.slice(window.start, window.end).map((row) => (
						<WorkTableRow height={virtual ? ROW_HEIGHT : undefined} item={row.original} key={row.id} state={state} />
					))}
					{window.bottom > 0 && (
						<tr>
							<td colSpan={columns.length} style={{ height: window.bottom, padding: 0 }} />
						</tr>
					)}
				</TableBody>
			</Table>
		</div>
	);
}

function HeaderRow({ headers, state }: { readonly headers: readonly Header<typeof features, WorkRow, unknown>[]; readonly state: State }) {
	return (
		<TableRow className="hover:bg-transparent">
			{headers.map((header) => (
				<SortableHead header={header} key={header.id} state={state} />
			))}
		</TableRow>
	);
}

function SortableHead({ header, state }: { readonly header: Header<typeof features, WorkRow, unknown>; readonly state: State }) {
	const label = String(header.column.columnDef.header);
	const sorted = header.column.getIsSorted();
	const className = `${widths[header.column.id] ?? ""} h-9 bg-card text-muted-foreground text-xs`;
	const sort = sortOf(header.column.id);
	if (!header.column.getCanSort() || sort === undefined) {
		return (
			<TableHead className={className} scope="col">
				{label}
			</TableHead>
		);
	}
	const Icon = sorted ? sortIcons[sorted] : ArrowUpDown;
	return (
		<TableHead aria-sort={sorted ? ariaSorts[sorted] : undefined} className={className} scope="col">
			<a
				className={buttonVariants({ className: "-ml-2 text-muted-foreground data-sorted:text-foreground", size: "sm", variant: "ghost" })}
				data-sorted={sorted ? "" : undefined}
				href={viewUrl(state, { order: sorted === "asc" ? "desc" : "asc", sort }, "work-results")}
			>
				{label}
				<Icon aria-hidden="true" className={sorted ? undefined : "opacity-50"} />
			</a>
		</TableHead>
	);
}

function sortOf(id: string): State["sort"] | undefined {
	return id === "title" || id === "kind" || id === "status" || id === "owner" ? id : undefined;
}
