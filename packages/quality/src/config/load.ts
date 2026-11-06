import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, type FileSystem, Path, Schema } from "effect";
import { readConfig } from "#adapters/readConfig.ts";
import { validOrFail } from "#decoded.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import type { SetupFailure } from "#failure.ts";
import type { InventoryScope } from "#inventory/collect.ts";
import { ConsumerDeclaration } from "#rules/suppressions/biome/ConsumerDeclaration.ts";
import type { Declaration } from "#rules/suppressions/biome/declarations.ts";
import { type ConfigInput, decodeConfig } from "./decode.ts";
import { DEFAULT_EXTENSIONS } from "./defaultExtensions.ts";
import { type ResolvedRules, resolveRules } from "./resolve.ts";

export interface ResolvedConfig extends ResolvedRules, InventoryScope {
	readonly baseline: string;
	readonly biomeDeclarations: readonly Declaration[];
	readonly exceptions: readonly ExceptionDeclaration[];
	readonly file: string;
	readonly nonEffectFolders: readonly string[];
	readonly registry: string;
	readonly root: string;
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
		baseline: config.baseline ?? "quality-baseline.jsonl",
		biomeDeclarations: biomeDeclarations(config),
		exceptions: config.exceptions ?? [],
		exclude: [],
		extensions: config.extensions ?? DEFAULT_EXTENSIONS,
		file,
		nonEffectFolders: config.nonEffectFolders ?? [],
		registry: config.registry ?? "quality/registry.json",
		root,
		sources: config.sources ?? ["."],
	};
}

export const loadConfig = Effect.fn("Config.loadConfig")(function* (
	cwd: string,
	path: string | undefined,
): Effect.fn.Return<ResolvedConfig, SetupFailure, FileSystem.FileSystem> {
	const { dirname } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const { file, loaded } = yield* readConfig(cwd, path);
	const config = yield* validOrFail(file, yield* Effect.promise(() => decodeConfig(loaded)));
	const rules = yield* validOrFail(file, yield* resolveRules(config));
	return resolved(dirname(file), file, config, rules);
});
