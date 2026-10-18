import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type HeaderGroup,
	type Row,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#client/ui/table.tsx";

function sortDirection(sorted: false | "asc" | "desc") {
	if (sorted === false) {
		return "none";
	}
	return sorted === "asc" ? "ascending" : "descending";
}

function HeadingRow<TData>({ group }: { readonly group: HeaderGroup<TData> }) {
	return (
		<TableRow>
			{group.headers.map((header) => (
				<TableHead aria-sort={sortDirection(header.column.getIsSorted())} key={header.id}>
					{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
				</TableHead>
			))}
		</TableRow>
	);
}

function DataRow<TData>({ row }: { readonly row: Row<TData> }) {
	return (
		<TableRow data-state={row.getIsSelected() ? "selected" : ""}>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
			))}
		</TableRow>
	);
}

function EmptyRow({ columns }: { readonly columns: number }) {
	return (
		<TableRow>
			<TableCell className="h-24 text-center" colSpan={columns}>
				No results.
			</TableCell>
		</TableRow>
	);
}

export function DataTable<TData, TValue>({
	"aria-label": ariaLabel,
	columns,
	data,
}: {
	readonly "aria-label": string;
	readonly columns: ColumnDef<TData, TValue>[];
	readonly data: TData[];
}) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const table = useReactTable({
		columns,
		data,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		state: { sorting },
	});
	return (
		<div className="overflow-hidden rounded-md border">
			<Table aria-label={ariaLabel}>
				<TableHeader>
					{table.getHeaderGroups().map((group) => (
						<HeadingRow group={group} key={group.id} />
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.length === 0 ? (
						<EmptyRow columns={columns.length} />
					) : (
						table.getRowModel().rows.map((row) => <DataRow key={row.id} row={row} />)
					)}
				</TableBody>
			</Table>
		</div>
	);
}
