import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "#client/ui/badge";
import { Button } from "#client/ui/button";
import type { Note } from "#notes.ts";
import { DataTable } from "./DataTable.tsx";

type SavedNote = typeof Note.Type;

const columns: ColumnDef<SavedNote>[] = [
	{
		accessorKey: "title",
		cell: ({ row }) => (
			<Link className="break-words underline" params={{ noteId: String(row.original.id) }} to="/notes/$noteId">
				{row.original.title}
			</Link>
		),
		header: ({ column }) => (
			<Button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} variant="ghost">
				Title
			</Button>
		),
	},
	{
		accessorKey: "wordCount",
		cell: ({ row }) => (
			<Badge variant="secondary">
				{row.original.wordCount === null ? "Counting words…" : `${row.original.wordCount} ${row.original.wordCount === 1 ? "word" : "words"}`}
			</Badge>
		),
		header: "Words",
	},
];

export function NotesTable({ notes }: { readonly notes: readonly SavedNote[] }) {
	return <DataTable columns={columns} data={[...notes]} />;
}
