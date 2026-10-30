import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { Effect, FileSystem, type PlatformError, Schema, type Scope } from "effect";
import ts from "typescript";

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
): Effect.fn.Return<string, PlatformError.PlatformError | Schema.SchemaError, FileSystem.FileSystem | Scope.Scope> {
	const existing = paths.get(original);
	if (existing !== undefined) {
		return existing;
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* fs.makeTempFileScoped({ directory: root, prefix: ".quality-biome-", suffix: ".json" });
	paths.set(original, path);
	const require = createRequire(original);
	const extended: string[] = [];
	for (const specifier of Array.isArray(config.extends) ? config.extends : []) {
		const source = specifier.startsWith(".") ? resolve(dirname(original), specifier) : require.resolve(specifier);
		const inherited = yield* parseConfig(source, yield* fs.readFileString(source));
		extended.push(yield* writeConfig(root, source, inherited, paths));
	}
	const vcs = Schema.is(ObjectConfig)(config.vcs) ? config.vcs : {};
	const generated = {
		...config,
		...(Array.isArray(config.extends) ? { extends: extended } : {}),
		...(Array.isArray(config.plugins)
			? {
					plugins: config.plugins.map((plugin) =>
						typeof plugin === "string" ? resolve(root, plugin) : { ...plugin, path: resolve(root, plugin.path) },
					),
				}
			: {}),
		vcs: { ...vcs, root: typeof vcs.root === "string" ? resolve(root, vcs.root) : root },
	};
	yield* fs.writeFileString(path, JSON.stringify(generated));
	return path;
});

export function relocateConfig(root: string, original: string, config: Readonly<Record<string, unknown>>) {
	return writeConfig(root, original, config, new Map());
}
