import { Console, Effect, type FileSystem } from "effect";
import { biomeReport, type Report } from "../biome/report.ts";
import { loadConfig } from "../config/load.ts";
import { SetupFailure } from "../failure.ts";
import { sortManifests } from "../manifests/sorted.ts";
import { plural } from "../report/plural.ts";

function biome(root: string, args: readonly string[]): Effect.Effect<Report, SetupFailure> {
	return Effect.tryPromise({
		catch: (cause) => new SetupFailure({ message: cause instanceof Error ? cause.message : String(cause) }),
		try: () => biomeReport(root, args),
	});
}

export function fix(cwd: string, config: string | undefined): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { root } = yield* loadConfig(cwd, config);
		const sorted = yield* Effect.mapError(sortManifests(root), (failure) => new SetupFailure({ message: failure.message }));
		yield* Console.log(`quality: sort-package-json rewrote ${plural(sorted, "manifest")}.`);
		const fixed = yield* biome(root, ["check", "--write", "--unsafe"]);
		yield* Console.log(`quality: Biome rewrote ${plural(fixed.summary.changed, "file")}.`);
		const formatted = yield* biome(root, ["format", "--write"]);
		yield* Console.log(`quality: Biome's format pass rewrote ${plural(formatted.summary.changed, "file")}.`);
	});
}
