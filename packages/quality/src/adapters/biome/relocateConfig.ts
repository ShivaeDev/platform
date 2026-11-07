import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { Effect, FileSystem, type PlatformError, Schema } from "effect";
import ts from "typescript";
import { nonEffectPlugins } from "#biome/nonEffectPlugins.ts";
import { cacheConfig } from "./cacheConfig.ts";

const ObjectConfig = Schema.Record(Schema.String, Schema.Unknown);

export function parseConfig(path: string, text: string) {
	const parsed = ts.parseConfigFileTextToJson(path, text);
	return parsed.error === undefined
		? Schema.decodeUnknownEffect(ObjectConfig)(parsed.config)
		: Effect.die(new Error(`Cannot load ${path}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, " ")}`));
}

const writeConfig = Effect.fn("Biome.writeConfig")(function* (
	root: string,
	original: string,
	config: Readonly<Record<string, unknown>>,
	paths: Map<string, string>,
	nonEffectFolders: readonly string[],
): Effect.fn.Return<string, PlatformError.PlatformError | Schema.SchemaError, FileSystem.FileSystem> {
	const existing = paths.get(original);
	if (existing !== undefined) {
		return existing;
	}
	const fs = yield* FileSystem.FileSystem;
	const require = createRequire(original);
	const extended: string[] = [];
	for (const specifier of Array.isArray(config.extends) ? config.extends : []) {
		const source = specifier.startsWith(".") ? resolve(dirname(original), specifier) : require.resolve(specifier);
		const inherited = yield* parseConfig(source, yield* fs.readFileString(source));
		extended.push(yield* writeConfig(root, source, inherited, paths, nonEffectFolders));
	}
	const vcs = config.vcs ?? {};
	const generated = {
		...config,
		...(Array.isArray(config.extends) ? { extends: extended } : {}),
		...(Array.isArray(config.plugins)
			? {
					plugins: nonEffectPlugins(config.plugins, nonEffectFolders).map((plugin) =>
						typeof plugin === "string" ? resolve(root, plugin) : { ...plugin, path: resolve(root, plugin.path) },
					),
				}
			: {}),
		vcs: Schema.is(ObjectConfig)(vcs)
			? {
					...vcs,
					root: typeof vcs.root === "string" ? resolve(root, vcs.root) : (vcs.root ?? root),
				}
			: vcs,
	};
	const path = yield* cacheConfig(root, generated);
	paths.set(original, path);
	return path;
});

export function relocateConfig(root: string, original: string, config: Readonly<Record<string, unknown>>, nonEffectFolders: readonly string[] = []) {
	return writeConfig(root, original, config, new Map(), nonEffectFolders);
}
