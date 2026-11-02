import { Link } from "@tanstack/react-router";
import { Cause, Option, Predicate } from "effect";
import { useId } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import { fieldRejectionOf } from "@shivaedev/form/fieldRejection.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import { useEditor } from "@shivaedev/react/client/editor.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";
import { type Note, NoteEditFields } from "#modules/notes/notes.ts";
import { NoteDelete } from "./Delete.tsx";
import type { NotesClient } from "./make.ts";

function Title<A, E, TRuntimeError>({ form }: { readonly form: Form<typeof NoteEditFields.fields, A, E, TRuntimeError> }) {
	const title = useField(form, "title");
	const titleId = useId();
	const errorId = useId();
	const titleError = Boolean(title.error) && (
		<p className="text-destructive text-sm" id={errorId} role="alert">
			{title.error}
		</p>
	);
	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium" htmlFor={titleId}>
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
			{titleError}
		</div>
	);
}

export function NoteEdit({
	client,
	loaded,
	onDeleted,
}: {
	readonly client: NotesClient;
	readonly loaded: typeof Note.Type;
	readonly onDeleted: () => void;
}) {
	const noteId = loaded.id;
	const editor = useEditor({
		fields: NoteEditFields,
		loaded,
		query: client.api.get.query({ id: noteId }),
		rejectField: fieldRejectionOf(NoteEditFields),
		runtime: client.runtime,
		save: (values) => client.api.update.run({ id: noteId, ...values }),
		values: (row) => ({ title: row.title, version: row.version }),
	});
	const currentNote = editor.query.data;
	const failure = Option.map(editor.failure, (error) => {
		if (Predicate.isTagged(error, "Conflict")) {
			return error.message;
		}
		if (Predicate.isTagged(error, "Unauthorized")) {
			return "Sign in to save this note.";
		}
		return "Could not save the note. Try again.";
	}).pipe(Option.orElse(() => Option.map(Option.filter(editor.cause, Cause.hasDies), () => "Could not save the note. Try again.")));
	const loadFailure = Option.isSome(editor.query.cause) && <p role="alert">Could not load this note. Try refreshing.</p>;
	const saveFailure = Option.isSome(failure) && (
		<p className="text-destructive text-sm" role="alert">
			{failure.value}
		</p>
	);
	return (
		<main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12 sm:px-6">
			<Link className="underline" to="/">
				Back to notes
			</Link>
			<h1 className="text-3xl font-semibold tracking-tight">Edit note</h1>
			<Button disabled={editor.query.pending} onClick={editor.query.refresh} variant="outline">
				Refresh
			</Button>
			{loadFailure}

			<form
				className="bg-card space-y-4 rounded-lg border p-5 shadow-sm"
				onSubmit={(event) => {
					event.preventDefault();
					editor.save();
				}}
			>
				<Title form={editor.form} />
				<Button disabled={editor.saving} type="submit">
					{editor.saving ? "Saving…" : "Save note"}
				</Button>
				{saveFailure}
				<p aria-live="polite" className="text-muted-foreground text-sm">
					{editor.dirty ? "Unsaved changes" : "All changes saved"}
				</p>
			</form>
			<NoteDelete client={client} note={currentNote} onDeleted={onDeleted} saving={editor.saving} />
		</main>
	);
}
