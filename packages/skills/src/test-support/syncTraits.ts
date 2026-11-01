import { Effect, FileSystem, Path } from "effect";
import { skills } from "./skills.ts";

export function unreadableSource(name: string) {
	return skills.trait("changed", `the installed ${name}/SKILL.md cannot be read during copying`, function* ({ installed }) {
		const fs = yield* FileSystem.FileSystem;
		const file = (yield* Path.Path).join(installed.root, "skills", name, "SKILL.md");
		yield* Effect.acquireRelease(fs.chmod(file, 0), () => fs.chmod(file, 0o644).pipe(Effect.orDie));
	});
}

export function aliasedDirectory(alias: string, target: string) {
	return skills.trait("changed", `${alias} is a directory alias to ${target}`, function* ({ repo }) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.join(repo, alias);
		yield* fs.remove(file, { force: true, recursive: true });
		yield* fs.makeDirectory(path.dirname(file), { recursive: true });
		yield* fs.symlink(target, file);
	});
}
