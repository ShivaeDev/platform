import { Cause, Option, Predicate } from "effect";
import { useEffect, useState } from "react";
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
	const [remove] = useState(() => client.runtime.fn((input: typeof Delete.payload.Type) => client.api.delete.run(input)));
	const action = useAction(remove);
	useEffect(() => {
		if (Option.isSome(action.data)) {
			onDeleted();
		}
	}, [action.data, onDeleted]);
	const failure = Option.flatMap(action.cause, Cause.findErrorOption);
	return (
		<div className="space-y-3">
			<Button disabled={saving || action.pending} onClick={() => action.dispatch({ id: note.id, version: note.version })} variant="outline">
				{action.pending ? "Deleting…" : "Delete note"}
			</Button>
			{Option.isSome(failure) && (
				<p className="text-destructive text-sm" role="alert">
					{Predicate.isTagged(failure.value, "Conflict") ? failure.value.message : "Could not delete the note. Try again."}
				</p>
			)}
		</div>
	);
}
