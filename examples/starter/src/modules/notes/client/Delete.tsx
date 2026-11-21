import { useAction } from "@shivaedev/react/client/resultState.ts";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import type { Notes } from "#generated/modules/notes/Notes.ts";
import { Button } from "#client/ui/button.tsx";
import type { Note } from "#modules/notes/model.ts";

export function NoteDelete({
	client,
	note,
	onDeleted,
	saving,
}: {
	readonly client: ContractClient<typeof Notes>;
	readonly note: typeof Note.Type;
	readonly onDeleted: () => void;
	readonly saving: boolean;
}) {
	const action = useAction(client.delete, { onSuccess: onDeleted });
	return (
		<div className="space-y-3">
			<Button disabled={saving || action.pending} onClick={() => action.dispatch({ id: note.id, version: note.version })} variant="outline">
				{action.pending ? "Deleting…" : "Delete note"}
			</Button>
		</div>
	);
}
