import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useId } from "react";
import { useField } from "@shivaedev/form/adapters/react.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import { useEditor } from "@shivaedev/react/client/editor.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";
import { NoteDelete } from "#modules/notes/client/Delete.tsx";
import type { NotesClient } from "#modules/notes/client/make.ts";
import type { Note, NoteEditFields } from "#modules/notes/model.ts";

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
	note,
	onDeleted,
}: {
	readonly client: NotesClient;
	readonly note: { readonly loaded: typeof Note.Type; readonly query: Atom.Atom<AsyncResult.AsyncResult<typeof Note.Type, unknown>> };
	readonly onDeleted: () => void;
}) {
	const noteId = note.loaded.id;
	const editor = useEditor(client.api.update, { ...note, fixed: { id: noteId } });
	const currentNote = editor.query.data;
	const loadFailure = Option.isSome(editor.query.cause) && <p role="alert">Could not load this note. Try refreshing.</p>;
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
				<p aria-live="polite" className="text-muted-foreground text-sm">
					{editor.dirty ? "Unsaved changes" : "All changes saved"}
				</p>
			</form>
			<NoteDelete client={client} note={currentNote} onDeleted={onDeleted} saving={editor.saving} />
		</main>
	);
}
