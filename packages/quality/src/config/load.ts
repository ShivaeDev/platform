import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem, Schema } from "effect";
import { validOrFail } from "#decoded.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { SetupFailure } from "#failure.ts";
import type { InventoryScope } from "#inventory/collect.ts";
import { ConsumerDeclaration } from "#rules/suppressions/biome/ConsumerDeclaration.ts";
import type { Declaration } from "#rules/suppressions/biome/declarations.ts";
import { type ConfigInput, decodeConfig } from "./decode.ts";
import { CONFIG_FILE } from "./file.ts";
import { type ResolvedRules, resolveRules } from "./resolve.ts";

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export interface ResolvedConfig extends ResolvedRules, InventoryScope {
	readonly baseline: string;
	readonly biomeDeclarations: readonly Declaration[];
	readonly exceptions: readonly ExceptionDeclaration[];
	readonly file: string;
	readonly registry: string;
	readonly root: string;
}

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

function importDefault(file: string): Effect.Effect<unknown, SetupFailure> {
	return Effect.flatMap(
		Effect.tryPromise({
			catch: (cause) => new SetupFailure({ message: `cannot load ${file}: ${messageOf(cause)}` }),
			try: async (): Promise<unknown> => import(pathToFileURL(file).href),
		}),
		(loaded) =>
			typeof loaded === "object" && loaded !== null && "default" in loaded
				? Effect.succeed(loaded.default)
				: Effect.fail(new SetupFailure({ message: `${file} has no default export. Export defineConfig({ ... }) as the default.` })),
	);
}

const LegacyOptions = Schema.Struct({ declared: Schema.Array(ConsumerDeclaration) });
function biomeDeclarations(config: ConfigInput): readonly Declaration[] {
	const setting = config.rules?.["suppressions/biome-overrides"];
	const options = typeof setting === "object" ? setting.options : undefined;
	return Schema.is(LegacyOptions)(options) ? options.declared : [];
}

function resolved(root: string, file: string, config: ConfigInput, rules: ResolvedRules): ResolvedConfig {
	return {
		...rules,
		baseline: config.baseline ?? "quality/baseline.jsonl",
		biomeDeclarations: biomeDeclarations(config),
		exceptions: config.exceptions ?? [],
		exclude: [],
		extensions: config.extensions ?? DEFAULT_EXTENSIONS,
		file,
		registry: config.registry ?? "quality/registry.json",
		root,
		sources: config.sources ?? ["."],
	};
}

export const loadConfig = Effect.fn("Config.loadConfig")(function* (
	cwd: string,
	path: string | undefined,
): Effect.fn.Return<ResolvedConfig, SetupFailure, FileSystem.FileSystem> {
	const fs = yield* FileSystem.FileSystem;
	const file = resolve(cwd, path ?? CONFIG_FILE);
	const entries = yield* fs
		.readDirectory(dirname(file))
		.pipe(
			Effect.catchTag("PlatformError", (error) =>
				error.reason._tag === "NotFound"
					? Effect.succeed<string[]>([])
					: Effect.fail(new SetupFailure({ message: `cannot inspect ${file}: ${error.message}` })),
			),
		);
	const present = entries.includes(basename(file));
	if (!present && path !== undefined) {
		return yield* new SetupFailure({ message: `no config at ${file}. Check the --config path.` });
	}
	const loaded = present ? yield* importDefault(file) : {};
	const config = yield* validOrFail(file, yield* Effect.promise(() => decodeConfig(loaded)));
	const rules = yield* validOrFail(file, yield* resolveRules(config));
	return resolved(dirname(file), file, config, rules);
});
