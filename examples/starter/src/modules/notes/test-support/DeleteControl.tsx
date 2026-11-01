import { useState } from "react";
import { NoteDelete } from "#modules/notes/client/Delete.tsx";
import type { NotesClient } from "#modules/notes/client/make.ts";
import type { Note } from "#modules/notes/notes.ts";

export function DeleteControl({ client, note }: { readonly client: NotesClient; readonly note: typeof Note.Type }) {
	const [deleted, setDeleted] = useState(false);
	return (
		<section aria-label={note.title}>
			<p>{deleted ? "Deleted" : "Not deleted"}</p>
			<NoteDelete client={client} note={note} onDeleted={() => setDeleted(true)} saving={false} />
		</section>
	);
}
