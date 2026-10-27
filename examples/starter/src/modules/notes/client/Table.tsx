import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "#client/ui/badge.tsx";
import { Button } from "#client/ui/button.tsx";
import type { Note } from "#modules/notes/notes.ts";
import { DataTable, type DataTableFeatures } from "./DataTable.tsx";

type SavedNote = typeof Note.Type;

const columnHelper = createColumnHelper<DataTableFeatures, SavedNote>();

const columns = columnHelper.columns([
	columnHelper.accessor("title", {
		cell: ({ row }) => (
			<Link className="break-words underline" params={{ noteId: row.original.id }} to="/notes/$noteId">
				{row.original.title}
			</Link>
		),
		header: ({ column }) => (
			<Button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} variant="ghost">
				Title
			</Button>
		),
	}),
	columnHelper.accessor("wordCount", {
		cell: ({ row }) => (
			<Badge variant="secondary">
				{row.original.wordCount === null ? "Counting words…" : `${row.original.wordCount} ${row.original.wordCount === 1 ? "word" : "words"}`}
			</Badge>
		),
		header: "Words",
	}),
]);

export function NotesTable({ notes }: { readonly notes: readonly SavedNote[] }) {
	return <DataTable aria-label="Saved notes" columns={columns} data={notes} />;
}
