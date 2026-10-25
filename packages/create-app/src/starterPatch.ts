import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { renderTemplate } from "./generation.ts";
import { checkedProcess } from "./runProcess.ts";
import type { Template } from "./template.ts";

export const starterPatch = Effect.fn("CreateApp.starterPatch")(function* (
	target: string,
	directory: string,
	name: string,
	before: Template,
	after: Template,
) {
	const fs = yield* FileSystem.FileSystem;
	const deleted = new Set<string>();
	for (const entry of before) {
		if (!(yield* fs.exists(join(target, entry.path)))) {
			deleted.add(entry.path);
		}
	}
	const base = before.filter((entry) => !deleted.has(entry.path));
	const incoming = after.filter((entry) => !deleted.has(entry.path));
	const repository = join(directory, "merge");
	yield* fs.makeDirectory(repository);
	yield* checkedProcess(repository, "git", ["init", "--quiet"]);
	yield* renderTemplate(repository, base, name);
	yield* checkedProcess(repository, "git", ["add", "--all"]);
	const tree = (yield* checkedProcess(repository, "git", ["write-tree"])).trim();
	for (const entry of base) {
		yield* checkedProcess(target, "git", ["hash-object", "-w", "--", join(repository, entry.path)]);
	}
	for (const path of yield* fs.readDirectory(repository)) {
		if (path !== ".git") {
			yield* fs.remove(join(repository, path), { recursive: true });
		}
	}
	yield* renderTemplate(repository, incoming, name);
	yield* checkedProcess(repository, "git", ["add", "--all"]);
	const patch = yield* checkedProcess(repository, "git", ["diff", "--cached", "--binary", "--full-index", "--no-renames", tree]);
	const path = join(directory, "starter.patch");
	yield* fs.writeFileString(path, patch);
	return { empty: patch.length === 0, path };
});
