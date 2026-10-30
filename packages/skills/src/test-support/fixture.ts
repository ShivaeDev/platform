import { Effect, FileSystem, Path } from "effect";
import { type Installed, readInstalled } from "#installed.ts";
import { SELECTION_FIELD } from "#layout.ts";

export const ALPHA = "---\nname: alpha\ndescription: Use alpha.\n---\n\n# Alpha\n";
export const ALPHA_NOTES = "Alpha's reference notes.\n";
export const BETA = "---\nname: beta\ndescription: Use beta.\n---\n\n# Beta\n";

export interface Fixture {
	installed: Installed;
	remote: string | undefined;
	readonly repo: string;
	selection: readonly string[];
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

export function select(engine: Fixture, skills: readonly string[]) {
	engine.selection = skills;
	return writeFile("package.json", `${JSON.stringify({ name: "consumer", [SELECTION_FIELD]: skills }, null, "\t")}\n`)(engine.repo);
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
	const fixture: Fixture = { installed: yield* readInstalled(root), remote: undefined, repo, selection: [] };
	return fixture;
});
