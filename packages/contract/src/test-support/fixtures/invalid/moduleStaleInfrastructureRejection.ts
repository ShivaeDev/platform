import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import { NotesRepository, SessionUser } from "#test/runNotes.ts";

const Operation = query("listsInfrastructure", {
	reads: () => [],
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany(userId);
	},
});

defineModule({
	name: "listsInfrastructure",
	operations: [Operation],
	requires: [NotesRepository, SessionUser],
	wire: {
		listsInfrastructure: { rejections: { QueryReadDenied }, success: Schema.Array(Schema.Struct({ id: Schema.Number, title: Schema.String })) },
	},
});
