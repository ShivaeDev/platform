import { Console, Effect, FileSystem, Option, Path } from "effect";
import { hashSkill } from "./hashSkill.ts";
import type { Installed } from "./installed.ts";
import { BIN, CLAUDE_SKILLS, MANIFEST, PACKAGE, SELECTION_FIELD, skillPaths } from "./layout.ts";
import { readManifest, writeManifest } from "./manifest.ts";
import { readSelection } from "./readSelection.ts";
import { SkillsError } from "./SkillsError.ts";

const isPresent = Effect.fn("Skills.isPresent")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	const isLink = yield* fs.readLink(file).pipe(
		Effect.as(true),
		Effect.orElseSucceed(() => false),
	);
	return isLink || (yield* fs.exists(file));
});

const refuseUnlisted = Effect.fn("Skills.refuseUnlisted")(function* (repo: string, names: readonly string[]) {
	const path = yield* Path.Path;
	const taken: string[] = [];
	for (const name of names) {
		const { copy, link } = skillPaths(path, repo, name);
		for (const file of [copy, link]) {
			if (yield* isPresent(file)) {
				taken.push(path.relative(repo, file));
			}
		}
	}
	if (taken.length > 0) {
		return yield* new SkillsError({
			message: `${BIN} sync would overwrite what ${MANIFEST} does not list:\n${taken.map((file) => `- ${file}`).join("\n")}\nRename or remove these, or drop the skill from "${SELECTION_FIELD}", then sync again.`,
		});
	}
});

const removeSkill = Effect.fn("Skills.removeSkill")(function* (repo: string, name: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const { copy, link } = skillPaths(path, repo, name);
	yield* fs.remove(copy, { force: true, recursive: true });
	yield* fs.remove(link, { force: true, recursive: true });
});

const copySkill = Effect.fn("Skills.copySkill")(function* (repo: string, installed: Installed, name: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const { copy, link, linkTarget } = skillPaths(path, repo, name);
	yield* removeSkill(repo, name);
	yield* fs.makeDirectory(path.dirname(copy), { recursive: true });
	yield* fs.copy(path.join(installed.root, "skills", name), copy);
	yield* fs.symlink(linkTarget, link);
	return yield* hashSkill(copy);
});

export const syncSkills = Effect.fn("Skills.syncSkills")(function* (repo: string, installed: Installed) {
	const selection = yield* readSelection(repo);
	const unknown = selection.filter((name) => !installed.skills.includes(name));
	if (unknown.length > 0) {
		return yield* new SkillsError({
			message: `${PACKAGE} ${installed.version} has no skill named ${unknown.join(", ")}. It ships: ${installed.skills.join(", ")}.`,
		});
	}
	const listed = Option.match(yield* readManifest(repo), { onNone: (): readonly string[] => [], onSome: (manifest) => Object.keys(manifest.skills) });
	yield* refuseUnlisted(
		repo,
		selection.filter((name) => !listed.includes(name)),
	);
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fs.makeDirectory(path.join(repo, CLAUDE_SKILLS), { recursive: true });
	const deselected = listed.filter((name) => !selection.includes(name));
	yield* Effect.forEach(deselected, (name) => removeSkill(repo, name));
	const hashes = yield* Effect.forEach(selection, (name) => Effect.map(copySkill(repo, installed, name), (hash) => [name, hash] as const));
	yield* writeManifest(repo, { skills: Object.fromEntries(hashes), version: installed.version });
	yield* Console.log(`Synced ${selection.length === 0 ? "no skills" : selection.join(", ")} from ${PACKAGE} ${installed.version}.`);
	if (deselected.length > 0) {
		yield* Console.log(`Removed ${deselected.join(", ")}.`);
	}
});
