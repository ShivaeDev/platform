import { Effect, FileSystem, Path, Schema } from "effect";
import { readCommand } from "#host/readCommand.ts";
import { FleetFailure } from "#policy.ts";
import { RepositoryPath } from "#preparation/schema.ts";

export interface ReportFile {
	readonly bytes: Uint8Array;
	readonly path: string;
}

export const reportDiffFiles = Effect.fn("Fleet.reportDiffFiles")(
	function* (diff: string) {
		if (!diff.trim()) {
			return [];
		}
		const sections = diff.split(/(?=^diff --git )/mu).filter((section) => section.trim());
		if (sections.some((section) => !(section.startsWith("diff --git ") && /^new file mode 100(?:644|755)$/mu.test(section)))) {
			return yield* Effect.fail(new FleetFailure({ message: "Report attachments must be newly created regular files", reason: "invalid" }));
		}
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const folder = yield* fs.makeTempDirectoryScoped();
		const stats = yield* readCommand("git", ["apply", "--numstat", "-z", "-"], folder, diff);
		const names = stats
			.split("\0")
			.filter(Boolean)
			.map((line) => line.split("\t").slice(2).join("\t"));
		if (names.length !== sections.length || names.some((name) => !Schema.is(RepositoryPath)(name) || name.split("/").includes(".git"))) {
			return yield* Effect.fail(new FleetFailure({ message: "Cloud report diff contains unsafe attachment paths", reason: "invalid" }));
		}
		yield* readCommand("git", ["apply", "--binary", "-"], folder, diff);
		return yield* Effect.forEach(names.sort(), (name) =>
			fs.readFile(path.join(folder, name)).pipe(Effect.map((bytes): ReportFile => ({ bytes, path: name }))),
		);
	},
	Effect.mapError(() => new FleetFailure({ message: "Cloud report diff could not be downloaded as new regular files", reason: "integration" })),
);
