import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem } from "effect";
import { validOrFail } from "../decoded.ts";
import { SetupFailure } from "../failure.ts";
import type { InventoryScope } from "../inventory/collect.ts";
import { type ConfigInput, decodeConfig } from "./decode.ts";
import { CONFIG_FILE } from "./file.ts";
import { type ResolvedRules, resolveRules } from "./resolve.ts";

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export interface ResolvedConfig extends ResolvedRules, InventoryScope {
	readonly root: string;
	readonly file: string;
	readonly registry: string;
	readonly baseline: string;
}

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const importDefault = (file: string): Effect.Effect<unknown, SetupFailure> =>
	Effect.flatMap(
		Effect.tryPromise({
			try: async (): Promise<unknown> => import(pathToFileURL(file).href),
			catch: (cause) => new SetupFailure({ message: `cannot load ${file}: ${messageOf(cause)}` }),
		}),
		(loaded) =>
			typeof loaded === "object" && loaded !== null && "default" in loaded
				? Effect.succeed(loaded.default)
				: Effect.fail(new SetupFailure({ message: `${file} has no default export. Export defineConfig({ ... }) as the default.` })),
	);

const resolved = (root: string, file: string, config: ConfigInput, rules: ResolvedRules): ResolvedConfig => ({
	...rules,
	baseline: config.baseline ?? "quality/baseline.json",
	exclude: config.exclude ?? [],
	extensions: config.extensions ?? DEFAULT_EXTENSIONS,
	file,
	registry: config.registry ?? "quality/registry.json",
	root,
	sources: config.sources ?? ["."],
});

export const loadConfig = (cwd: string, path: string | undefined): Effect.Effect<ResolvedConfig, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const file = resolve(cwd, path ?? CONFIG_FILE);
		const present = yield* Effect.orElseSucceed(fs.exists(file), () => false);
		if (!present) {
			return yield* new SetupFailure({ message: `no config at ${file}. Create ${CONFIG_FILE} exporting defineConfig({ ... }), or pass --config.` });
		}
		const loaded = yield* importDefault(file);
		const config = yield* validOrFail(file, yield* Effect.promise(() => decodeConfig(loaded)));
		const rules = yield* validOrFail(file, yield* resolveRules(config));
		return resolved(dirname(file), file, config, rules);
	});
