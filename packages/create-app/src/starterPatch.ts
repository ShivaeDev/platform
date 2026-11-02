import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { renderTemplate } from "#generation.ts";
import { checkedProcess } from "#runProcess.ts";
import type { Template } from "#template.ts";

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
	const conflicts: { path: string; indexInfo: string }[] = [];
	const retained: Template[number][] = [];
	for (const entry of base) {
		const hash = (yield* checkedProcess(target, "git", ["hash-object", "-w", "--", join(repository, entry.path)])).trim();
		if (!incoming.some((file) => file.path === entry.path)) {
			const ours = yield* checkedProcess(target, "git", ["--literal-pathspecs", "ls-files", "--stage", "--full-name", "-z", "--", entry.path]);
			if (!ours.startsWith(`100644 ${hash} 0\t`)) {
				const indexedPath = ours.slice(ours.indexOf("\t") + 1, -1);
				const indexInfo = [`0 ${hash}\t${indexedPath}\0`, `100644 ${hash} 1\t${indexedPath}\0`, ours.replace(" 0\t", " 2\t")].join("");
				conflicts.push({ indexInfo, path: entry.path });
				// Git apply rejects these deletions before applying any of the delta.
				retained.push(entry);
			}
		}
	}
	for (const path of yield* fs.readDirectory(repository)) {
		if (path !== ".git") {
			yield* fs.remove(join(repository, path), { recursive: true });
		}
	}
	yield* renderTemplate(repository, [...incoming, ...retained], name);
	yield* checkedProcess(repository, "git", ["add", "--all"]);
	const patch = yield* checkedProcess(repository, "git", ["diff", "--cached", "--binary", "--full-index", "--no-renames", tree]);
	const path = join(directory, "starter.patch");
	yield* fs.writeFileString(path, patch);
	return { conflicts, empty: patch.length === 0, path };
});
