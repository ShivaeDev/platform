import { Cause, Option, Predicate } from "effect";
import { useAction } from "@shivaedev/react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import type { Delete, Note } from "#modules/notes/notes.ts";
import type { NotesClient } from "./make.ts";

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
	const action = useAction(client.runtime, (input: typeof Delete.payload.Type) => client.api.delete.run(input), { onSuccess: onDeleted });
	const failure = Option.flatMap(action.cause, Cause.findErrorOption);
	const failureMessage = Option.isSome(failure) && (
		<p className="text-destructive text-sm" role="alert">
			{Predicate.isTagged(failure.value, "Conflict") ? failure.value.message : "Could not delete the note. Try again."}
		</p>
	);
	return (
		<div className="space-y-3">
			<Button disabled={saving || action.pending} onClick={() => action.dispatch({ id: note.id, version: note.version })} variant="outline">
				{action.pending ? "Deleting…" : "Delete note"}
			</Button>
			{failureMessage}
		</div>
	);
}
