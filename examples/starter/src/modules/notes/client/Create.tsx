import { Option, Predicate } from "effect";
import { useId } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import { useCreate } from "@shivaedev/react/client/create.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";
import { NoteFields } from "#modules/notes/notes.ts";
import type { NotesClient } from "./make.ts";

export function NoteCreate({ client }: { readonly client: NotesClient }) {
	const titleId = useId();
	const errorId = useId();
	const create = useCreate({ create: client.api.create.run, fields: NoteFields, initialValues: { title: "" }, runtime: client.runtime });
	const title = useField(create.form, "title");
	return (
		<form
			className="space-y-3"
			onSubmit={(event) => {
				event.preventDefault();
				create.save();
			}}
		>
			<label className="block font-medium text-sm" htmlFor={titleId}>
				New note
			</label>
			<div className="flex flex-col gap-3 sm:flex-row">
				<Input
					aria-describedby={title.error ? errorId : undefined}
					aria-invalid={Boolean(title.error)}
					id={titleId}
					onBlur={title.onBlur}
					onChange={(event) => title.onChange(event.target.value)}
					placeholder="Something to remember"
					value={title.value}
				/>
				<Button disabled={create.saving} type="submit">
					{create.saving ? "Adding…" : "Add note"}
				</Button>
			</div>
			{Boolean(title.error) && (
				<p className="text-destructive text-sm" id={errorId} role="alert">
					{title.error}
				</p>
			)}
			{Option.isSome(create.failure) && (
				<p className="text-destructive text-sm" role="alert">
					{Predicate.isTagged(create.failure.value, "Unauthorized") ? "Sign in to add a note." : "Could not add the note. Try again."}
				</p>
			)}
			<p aria-live="polite" className="text-muted-foreground text-sm">
				{Option.isSome(create.created) ? `Added ${create.created.value.title}` : "Notes are saved to PostgreSQL."}
			</p>
		</form>
	);
}
