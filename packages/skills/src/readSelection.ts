import { Effect, FileSystem, Order, Path, Schema } from "effect";
import { SELECTION_FIELD } from "./layout.ts";
import { SkillsError } from "./SkillsError.ts";

const ConsumerManifest = Schema.fromJsonString(Schema.Struct({ [SELECTION_FIELD]: Schema.optional(Schema.Array(Schema.String)) }));

export const readSelection = Effect.fn("Skills.readSelection")(function* (repo: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const file = path.join(repo, "package.json");
	const text = yield* fs
		.readFileString(file)
		.pipe(Effect.mapError((cause) => new SkillsError({ cause, message: `Could not read ${file}: ${cause.message}` })));
	const manifest = yield* Schema.decodeUnknownEffect(ConsumerManifest)(text).pipe(
		Effect.mapError((cause) => new SkillsError({ cause, message: `${file}: "${SELECTION_FIELD}" must be a list of skill names. ${cause.message}` })),
	);
	const selected = manifest[SELECTION_FIELD];
	if (selected === undefined) {
		return yield* new SkillsError({
			message: `${file} selects no skills. Add the skills this repository uses, such as "${SELECTION_FIELD}": ["pr-description"].`,
		});
	}
	return [...new Set(selected)].sort(Order.String);
});
