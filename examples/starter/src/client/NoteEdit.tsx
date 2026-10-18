import { useAtomMount } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { Option, Predicate } from "effect";
import { useId } from "react";
import { useField } from "@shivaedev/effect-form/client/react.ts";
import type { Form } from "@shivaedev/effect-form/shape.ts";
import { useEditor } from "@shivaedev/effect-react/client/editor.ts";
import { fieldRejectionOf } from "@shivaedev/effect-react/fieldRejection.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";
import { NoteEditFields } from "#notes.ts";
import type { NotesClient } from "./makeNotes.ts";
import { NoteDelete } from "./NoteDelete.tsx";

function Title<A, E, TRuntimeError>({ form }: { readonly form: Form<typeof NoteEditFields.fields, A, E, TRuntimeError> }) {
	const title = useField(form, "title");
	const titleId = useId();
	const errorId = useId();
	return (
		<div className="space-y-2">
			<label className="block font-medium text-sm" htmlFor={titleId}>
				Title
			</label>
			<Input
				aria-describedby={title.error ? errorId : undefined}
				aria-invalid={Boolean(title.error)}
				id={titleId}
				onBlur={title.onBlur}
				onChange={(event) => title.onChange(event.target.value)}
				value={title.value}
			/>
			{Boolean(title.error) && (
				<p className="text-destructive text-sm" id={errorId} role="alert">
					{title.error}
				</p>
			)}
		</div>
	);
}

export function NoteEdit({ client, noteId, onDeleted }: { readonly client: NotesClient; readonly noteId: number; readonly onDeleted: () => void }) {
	useAtomMount(client.connection);
	const editor = useEditor({
		fields: NoteEditFields,
		query: client.api.get.query({ id: noteId }),
		rejectField: fieldRejectionOf(NoteEditFields),
		runtime: client.runtime,
		save: (values) => client.api.update.run({ id: noteId, ...values }),
		values: (row) => ({ title: row.title, version: row.version }),
	});
	const currentNote = Option.getOrUndefined(editor.query.data);
	const failure = Option.map(editor.failure, (error) => {
		if (Predicate.isTagged(error, "Conflict")) {
			return error.message;
		}
		if (Predicate.isTagged(error, "Unauthorized")) {
			return "Sign in to save this note.";
		}
		return "Could not save the note. Try again.";
	});
	return (
		<main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">
			<Link className="underline" to="/">
				Back to notes
			</Link>
			<h1 className="font-semibold text-3xl tracking-tight">Edit note</h1>
			<Button disabled={editor.query.pending} onClick={editor.query.refresh} variant="outline">
				Refresh
			</Button>
			{Option.isSome(editor.query.cause) && <p role="alert">Could not load this note. Try refreshing.</p>}
			{editor.form === undefined ? (
				<p role="status">Loading note…</p>
			) : (
				<form
					className="space-y-4 rounded-lg border bg-card p-5 shadow-sm"
					onSubmit={(event) => {
						event.preventDefault();
						editor.save();
					}}
				>
					<Title form={editor.form} />
					<Button disabled={editor.saving} type="submit">
						{editor.saving ? "Saving…" : "Save note"}
					</Button>
					{Option.isSome(failure) && (
						<p className="text-destructive text-sm" role="alert">
							{failure.value}
						</p>
					)}
					<p aria-live="polite" className="text-muted-foreground text-sm">
						{editor.dirty ? "Unsaved changes" : "All changes saved"}
					</p>
				</form>
			)}
			{currentNote !== undefined && <NoteDelete client={client} note={currentNote} onDeleted={onDeleted} saving={editor.saving} />}
		</main>
	);
}
