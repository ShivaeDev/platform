import { query } from "#operation.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import { NotesRepository, SessionUser } from "#test/runNotes.ts";

query("listsInfrastructure", {
	reads: () => [],
	rejections: { QueryReadDenied },
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany(userId);
	},
});
