import { Effect, FileSystem, Option, Path } from "effect";
import { generatedFrom } from "#emit.ts";
import { readIfPresent } from "#files.ts";
import type { Project } from "#inputs.ts";
import type { ModuleOutcome } from "#report.ts";

interface Orphan {
	readonly file: string;
	readonly source: string;
}

// A file this generator wrote for a module that no longer exists at that path, such as one renamed or deleted since.
const orphansOf = Effect.fn("Build.orphansOf")(function* (generated: string, outputs: ReadonlySet<string>) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fs.exists(generated))) {
		return [];
	}
	const entries = (yield* fs.readDirectory(generated, { recursive: true })).map((entry) => path.join(generated, entry)).sort();
	const orphans = yield* Effect.forEach(
		entries.filter((file) => file.endsWith(".ts") && !outputs.has(file)),
		(file) =>
			Effect.gen(function* () {
				if ((yield* fs.stat(file)).type !== "File") {
					return [];
				}
				const source = Option.flatMap(yield* readIfPresent(file), (text) => Option.fromUndefinedOr(generatedFrom(text)));
				return Option.isSome(source) ? [{ file, source: source.value } satisfies Orphan] : [];
			}),
	);
	return orphans.flat();
});

// Removes each orphan, or under --check only reports it.
export const settleOrphans = Effect.fn("Build.settleOrphans")(function* (project: Project, outputs: ReadonlySet<string>, check: boolean) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	return yield* Effect.forEach(yield* orphansOf(project.generated, outputs), (orphan) =>
		Effect.gen(function* () {
			if (!check) {
				yield* fs.remove(orphan.file);
			}
			const outcome: ModuleOutcome = {
				module: orphan.source,
				output: path.relative(project.root, orphan.file),
				status: check ? "orphaned" : "removed",
			};
			return outcome;
		}),
	);
});
