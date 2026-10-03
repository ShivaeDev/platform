import { Console, Effect, type FileSystem } from "effect";
import { biomeReport } from "../biome/report.ts";
import { loadConfig } from "../config/load.ts";
import { SetupFailure } from "../failure.ts";
import { sortManifests } from "../manifests/sorted.ts";
import { plural } from "../report/plural.ts";

export function fix(cwd: string, config: string | undefined): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { root } = yield* loadConfig(cwd, config);
		const sorted = yield* Effect.mapError(sortManifests(root), (failure) => new SetupFailure({ message: failure.message }));
		yield* Console.log(`quality: sort-package-json rewrote ${plural(sorted, "manifest")}.`);
		const report = yield* Effect.tryPromise({
			catch: (cause) => new SetupFailure({ message: cause instanceof Error ? cause.message : String(cause) }),
			try: () => biomeReport(root, ["check", "--write"]),
		});
		yield* Console.log(`quality: Biome rewrote ${plural(report.summary.changed, "file")}.`);
	});
}
