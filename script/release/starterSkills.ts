import { join } from "node:path";
import { Effect, FileSystem, Option, Schema } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { checkSkills } from "@shivaedev/skills/checkSkills.ts";
import { readInstalled } from "@shivaedev/skills/installed.ts";
import { SELECTION_FIELD } from "@shivaedev/skills/layout.ts";
import { syncSkills } from "@shivaedev/skills/syncSkills.ts";

const STARTER_PATH = "examples/starter";
const SKILLS_PATH = "packages/skills";

const Starter = Schema.fromJsonString(Schema.Struct({ [SELECTION_FIELD]: Schema.optional(Schema.Unknown) }));

const starterSkills = Effect.fn("Release.starterSkills")(
	function* (root: string) {
		const text = yield* (yield* FileSystem.FileSystem).readFileString(join(root, STARTER_PATH, "package.json"));
		// A starter that selects no skills keeps no copy to align.
		if ((yield* Schema.decodeUnknownEffect(Starter)(text))[SELECTION_FIELD] === undefined) {
			return Option.none();
		}
		return Option.some({ installed: yield* readInstalled(join(root, SKILLS_PATH)), starter: join(root, STARTER_PATH) });
	},
	Effect.catchTag("SchemaError", (cause) =>
		Effect.fail(
			new ChangesetError({
				cause,
				message: `${STARTER_PATH}/package.json and ${SKILLS_PATH}/package.json must be package manifests. ${cause.message}`,
			}),
		),
	),
);

export const checkStarterSkills = Effect.fn("Release.checkStarterSkills")(function* (root: string) {
	const skills = yield* starterSkills(root);
	if (Option.isSome(skills)) {
		yield* checkSkills(skills.value.starter, skills.value.installed).pipe(
			Effect.catchTag("SkillsError", (cause) =>
				Effect.fail(
					new ChangesetError({
						cause,
						message: `${STARTER_PATH}: ${cause.message} In ${STARTER_PATH} that is pnpm skills:sync, and pnpm releases apply runs it for a release.`,
					}),
				),
			),
		);
	}
});

export const alignStarterSkills = Effect.fn("Release.alignStarterSkills")(function* (root: string) {
	const skills = yield* starterSkills(root);
	if (Option.isSome(skills)) {
		yield* syncSkills(skills.value.starter, skills.value.installed).pipe(
			Effect.catchTag("SkillsError", (cause) => Effect.fail(new ChangesetError({ cause, message: `${STARTER_PATH}: ${cause.message}` }))),
		);
	}
});
