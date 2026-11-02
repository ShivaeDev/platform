import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem } from "effect";
import { CONFIG_FILE } from "#config/constants.ts";
import { SetupFailure } from "#failure.ts";

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

function importDefault(file: string): Effect.Effect<unknown, SetupFailure> {
	return Effect.flatMap(
		Effect.tryPromise({
			catch: (cause) => new SetupFailure({ cause, message: `cannot load ${file}: ${messageOf(cause)}` }),
			try: async (): Promise<unknown> => import(pathToFileURL(file).href),
		}),
		(loaded) =>
			typeof loaded === "object" && loaded !== null && "default" in loaded
				? Effect.succeed(loaded.default)
				: Effect.fail(new SetupFailure({ message: `${file} has no default export. Export defineConfig({ ... }) as the default.` })),
	);
}

export const readConfig = Effect.fn("Config.readConfig")(function* (cwd: string, path: string | undefined) {
	const fs = yield* FileSystem.FileSystem;
	const file = resolve(cwd, path ?? CONFIG_FILE);
	const entries = yield* fs
		.readDirectory(dirname(file))
		.pipe(
			Effect.catchTag("PlatformError", (error) =>
				error.reason._tag === "NotFound"
					? Effect.succeed<string[]>([])
					: Effect.fail(new SetupFailure({ cause: error, message: `cannot inspect ${file}: ${error.message}` })),
			),
		);
	const present = entries.includes(basename(file));
	if (!present && path !== undefined) {
		return yield* new SetupFailure({ message: `no config at ${file}. Check the --config path.` });
	}
	const loaded = present ? yield* importDefault(file) : {};
	return { file, loaded };
});
