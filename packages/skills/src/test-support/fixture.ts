import { Effect, FileSystem, Path } from "effect";
import { type Installed, readInstalled } from "#installed.ts";
import { SELECTION_FIELD } from "#layout.ts";

export const ALPHA = "---\nname: alpha\ndescription: Use alpha.\n---\n\n# Alpha\n";
export const ALPHA_NOTES = "Alpha's reference notes.\n";
export const BETA = "---\nname: beta\ndescription: Use beta.\n---\n\n# Beta\n";

export interface Fixture {
	installed: Installed;
	readonly repo: string;
}

export function writeFile(file: string, content: string) {
	return Effect.fn("SkillsFixture.writeFile")(function* (root: string) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
		yield* fs.writeFileString(path.join(root, file), content);
	});
}

export function removeFile(file: string) {
	return Effect.fn("SkillsFixture.removeFile")(function* (root: string) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fs.remove(path.join(root, file), { recursive: true });
	});
}

export const readFile = Effect.fn("SkillsFixture.readFile")(function* (root: string, file: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	return yield* fs.readFileString(path.join(root, file));
});

export function select(repo: string, skills: readonly string[]) {
	return writeFile("package.json", `${JSON.stringify({ name: "consumer", [SELECTION_FIELD]: skills }, null, "\t")}\n`)(repo);
}

export const makeFixture = Effect.fn("SkillsFixture.makeFixture")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "skills-package-" });
	yield* writeFile("package.json", '{ "name": "@shivaedev/skills", "version": "1.2.0" }\n')(root);
	yield* writeFile("skills/alpha/SKILL.md", ALPHA)(root);
	yield* writeFile("skills/alpha/references/notes.md", ALPHA_NOTES)(root);
	yield* writeFile("skills/beta/SKILL.md", BETA)(root);
	const repo = yield* fs.makeTempDirectoryScoped({ prefix: "skills-consumer-" });
	yield* writeFile("package.json", '{ "name": "consumer" }\n')(repo);
	const fixture: Fixture = { installed: yield* readInstalled(root), repo };
	return fixture;
});
