import { Effect, FileSystem, Option, Path } from "effect";
import { definesModule } from "#adapters/typeScript.ts";
import { generatedFrom } from "#emit.ts";
import { readIfPresent } from "#files.ts";
import type { Project } from "#inputs.ts";
import type { ModuleOutcome } from "#report.ts";

interface Orphan {
	readonly file: string;
	readonly source: string;
}

const definesModuleStill = Effect.fn("Build.definesModuleStill")(function* (project: Project, source: string) {
	const path = yield* Path.Path;
	const module = path.join(project.root, source);
	return Option.exists(yield* readIfPresent(module), (text) => definesModule(module, text));
});

// Decided by the module the header names, never by comparing paths: on a case-insensitive file system a folder renamed by
// case alone lists the module's own file under its old spelling.
const orphansOf = Effect.fn("Build.orphansOf")(function* (project: Project) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fs.exists(project.generated))) {
		return [];
	}
	const entries = (yield* fs.readDirectory(project.generated, { recursive: true })).map((entry) => path.join(project.generated, entry)).sort();
	const orphans = yield* Effect.forEach(
		entries.filter((file) => file.endsWith(".ts")),
		(file) =>
			Effect.gen(function* () {
				if ((yield* fs.stat(file)).type !== "File") {
					return [];
				}
				const source = Option.flatMap(yield* readIfPresent(file), (text) => Option.fromUndefinedOr(generatedFrom(text)));
				return Option.isSome(source) && !(yield* definesModuleStill(project, source.value)) ? [{ file, source: source.value } satisfies Orphan] : [];
			}),
	);
	return orphans.flat();
});

export const settleOrphans = Effect.fn("Build.settleOrphans")(function* (project: Project, check: boolean) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	return yield* Effect.forEach(yield* orphansOf(project), (orphan) =>
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
