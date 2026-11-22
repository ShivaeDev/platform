import { Effect, FileSystem, Option, Path, type PlatformError } from "effect";
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

// Another run may remove its draft's folder or an orphan between a listing and the next step, so a folder that is gone reads as
// empty and a file that is gone is skipped; every other failure still stops the run.
const filesUnder = Effect.fn("Build.filesUnder")(function* (
	folder: string,
): Effect.fn.Return<readonly string[], PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const entries = yield* fs.readDirectoryEntries(folder).pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed([])));
	const found = yield* Effect.forEach(entries, (entry) =>
		entry.type === "Directory" ? filesUnder(path.join(folder, entry.name)) : Effect.succeed([path.join(folder, entry.name)]),
	);
	return found.flat();
});

const isFile = Effect.fn("Build.isFile")(function* (file: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.stat(file).pipe(
		Effect.map((info) => info.type === "File"),
		Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(false)),
	);
});

// Decided by the module the header names, never by comparing paths: on a case-insensitive file system a folder renamed by
// case alone lists the module's own file under its old spelling.
const orphansOf = Effect.fn("Build.orphansOf")(function* (project: Project) {
	const files = (yield* filesUnder(project.generated)).filter((file) => file.endsWith(".ts")).toSorted();
	const orphans = yield* Effect.forEach(files, (file) =>
		Effect.gen(function* () {
			if (!(yield* isFile(file))) {
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
				yield* fs.remove(orphan.file).pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.void));
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
