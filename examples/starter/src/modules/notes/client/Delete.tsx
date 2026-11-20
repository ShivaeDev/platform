import { useAction } from "@shivaedev/react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import type { NotesClient } from "#modules/notes/client/make.ts";
import type { Note } from "#modules/notes/model.ts";

export function NoteDelete({
	client,
	note,
	onDeleted,
	saving,
}: {
	readonly client: NotesClient;
	readonly note: typeof Note.Type;
	readonly onDeleted: () => void;
	readonly saving: boolean;
}) {
	const action = useAction(client.api.delete, { onSuccess: onDeleted });
	return (
		<div className="space-y-3">
			<Button disabled={saving || action.pending} onClick={() => action.dispatch({ id: note.id, version: note.version })} variant="outline">
				{action.pending ? "Deleting…" : "Delete note"}
			</Button>
		</div>
	);
}
