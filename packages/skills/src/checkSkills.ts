import { Console, Effect, Option, Path } from "effect";
import { hashSkill } from "./hashSkill.ts";
import type { Installed } from "./installed.ts";
import { BIN, MANIFEST, PACKAGE, SELECTION_FIELD, skillPaths } from "./layout.ts";
import { type Manifest, readManifest } from "./manifest.ts";
import { readSelection } from "./readSelection.ts";
import { SkillsError } from "./SkillsError.ts";

function selectionProblems(selection: readonly string[], listed: readonly string[]): readonly string[] {
	return [
		...selection.filter((name) => !listed.includes(name)).map((name) => `${name} is selected in "${SELECTION_FIELD}" but not synced.`),
		...listed.filter((name) => !selection.includes(name)).map((name) => `${name} is synced but no longer selected in "${SELECTION_FIELD}".`),
	];
}

const copyProblems = Effect.fn("Skills.copyProblems")(function* (repo: string, manifest: Manifest) {
	const path = yield* Path.Path;
	const problems: string[] = [];
	for (const [name, expected] of Object.entries(manifest.skills)) {
		const { copy } = skillPaths(path, repo, name);
		const actual = yield* hashSkill(copy).pipe(Effect.option);
		if (Option.isNone(actual)) {
			problems.push(`${path.relative(repo, copy)} is missing.`);
		} else if (actual.value !== expected) {
			problems.push(`${path.relative(repo, copy)} differs from what ${BIN} synced. Shared skills change in ${PACKAGE}, not in the copy.`);
		}
	}
	return problems;
});

const problemsOf = Effect.fn("Skills.problemsOf")(function* (repo: string, installed: Installed, manifest: Manifest) {
	const selection = yield* readSelection(repo);
	return [
		...(manifest.version === installed.version
			? []
			: [`The skills were synced from ${PACKAGE} ${manifest.version}, but ${installed.version} is installed.`]),
		...selectionProblems(selection, Object.keys(manifest.skills)),
		...(yield* copyProblems(repo, manifest)),
	];
});

export const checkSkills = Effect.fn("Skills.checkSkills")(function* (repo: string, installed: Installed) {
	const manifest = yield* readManifest(repo);
	const problems = Option.isNone(manifest) ? [`${MANIFEST} is missing.`] : yield* problemsOf(repo, installed, manifest.value);
	if (problems.length > 0) {
		return yield* new SkillsError({
			message: `The shared skills are out of sync:\n${problems.map((problem) => `- ${problem}`).join("\n")}\nRun \`${BIN} sync\` and commit the result.`,
		});
	}
	yield* Console.log(`The shared skills match ${PACKAGE} ${installed.version}.`);
});
