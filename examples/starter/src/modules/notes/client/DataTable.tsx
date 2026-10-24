import {
	type ColumnDef,
	createSortedRowModel,
	FlexRender,
	type HeaderGroup,
	type Row,
	type RowData,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#client/ui/table.tsx";

const features = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime, text: sortFn_text },
});

export type DataTableFeatures = typeof features;

function sortDirection(sorted: false | "asc" | "desc") {
	if (sorted === false) {
		return "none";
	}
	return sorted === "asc" ? "ascending" : "descending";
}

function HeadingRow<TData extends RowData>({ group }: { readonly group: HeaderGroup<DataTableFeatures, TData> }) {
	return (
		<TableRow>
			{group.headers.map((header) => (
				<TableHead aria-sort={sortDirection(header.column.getIsSorted())} key={header.id}>
					{header.isPlaceholder ? null : <FlexRender header={header} />}
				</TableHead>
			))}
		</TableRow>
	);
}

function DataRow<TData extends RowData>({ row }: { readonly row: Row<DataTableFeatures, TData> }) {
	return (
		<TableRow>
			{row.getAllCells().map((cell) => (
				<TableCell key={cell.id}>
					<FlexRender cell={cell} />
				</TableCell>
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

export function DataTable<TData extends RowData>({
	"aria-label": ariaLabel,
	columns,
	data,
}: {
	readonly "aria-label": string;
	readonly columns: readonly ColumnDef<DataTableFeatures, TData>[];
	readonly data: readonly TData[];
}) {
	const table = useTable({ columns, data, features });
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
