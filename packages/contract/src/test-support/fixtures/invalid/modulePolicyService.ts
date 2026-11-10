import { Effect, Option } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { NoteId, NotesRepository, SessionUser } from "#test/runNotes.ts";

const Owned = query("owned", {
	payload: NoteId,
	readPolicy: ({ id }, viewer) =>
		Effect.gen(function* () {
			const repository = yield* NotesRepository;
			return Option.isSome(viewer) && Option.isSome(yield* repository.findOne(id, viewer.value.id));
		}),
	reads: () => [],
	*run({ id }) {
		const { id: userId } = yield* SessionUser;
		return `${userId}: ${id}`;
	},
});

defineModule({
	name: "owned",
	operations: [Owned],
	requires: [SessionUser],
});
