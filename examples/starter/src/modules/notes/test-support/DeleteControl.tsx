import { useState } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import type { Notes } from "#generated/modules/notes/Notes.ts";
import { NoteDelete } from "#modules/notes/client/Delete.tsx";
import type { Note } from "#modules/notes/model.ts";

export function DeleteControl({ client, note }: { readonly client: ContractClient<typeof Notes>; readonly note: typeof Note.Type }) {
	const [deleted, setDeleted] = useState(false);
	return (
		<section aria-label={note.title}>
			<p>{deleted ? "Deleted" : "Not deleted"}</p>
			<NoteDelete client={client} note={note} onDeleted={() => setDeleted(true)} saving={false} />
		</section>
	);
}
