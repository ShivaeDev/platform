import { relative } from "node:path";
import { Effect } from "effect";
import { setManifestFiles } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { loadConfig, type ResolvedConfig } from "#config/load.ts";
import { validOrFail } from "#decoded.ts";
import { decodeRegistry, type RegistryEntry } from "#exceptions/registry.ts";
import { registryEntries } from "#exceptions/registryEntries.ts";
import { SetupFailure } from "#failure.ts";
import { collectInventory, type Inventory } from "#inventory/collect.ts";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import type { RuleServices } from "#rule.ts";
import { type BaselineFile, readBaseline, readInput } from "./baselineFile.ts";
import { runRules } from "./runRules.ts";
import type { Violation } from "./violation.ts";

export interface Session {
	readonly baseline: BaselineFile;
	readonly config: ResolvedConfig;
	readonly inventory: Inventory;
	readonly registry: readonly RegistryEntry[];
	readonly violations: readonly Violation[];
}

function setup<TValue, TRequirements>(
	effect: Effect.Effect<TValue, FilesystemFailure, TRequirements>,
): Effect.Effect<TValue, SetupFailure, TRequirements> {
	return Effect.mapError(effect, (failure) => new SetupFailure({ cause: failure, message: failure.message }));
}

export const scan = Effect.fn("Engine.scan")(function* (
	config: ResolvedConfig,
): Effect.fn.Return<Pick<Session, "inventory" | "violations">, SetupFailure, RuleServices> {
	const inventory = yield* setup(collectInventory(config.root, config));
	const readText = yield* manifestReader(config.root);
	setManifestFiles(readText, inventory.manifestFiles);
	const violations = yield* runRules(config.active, {
		configFile: relative(config.root, config.file),
		exceptions: config.exceptions,
		files: inventory.files,
		readText,
		root: config.root,
		sources: inventory.sources,
	});
	return { inventory, violations };
});

export const openSession = Effect.fn("Engine.openSession")(function* (
	cwd: string,
	configPath: string | undefined,
): Effect.fn.Return<Session, SetupFailure, RuleServices> {
	const config = yield* loadConfig(cwd, configPath);
	const registryRaw = yield* readInput(config.root, config.registry);
	const registry = yield* validOrFail(config.registry, yield* Effect.promise(() => decodeRegistry(registryRaw)));
	const baseline = yield* readBaseline(config);
	const { inventory, violations } = yield* scan(config);
	return { baseline, config, inventory, registry: [...registry, ...registryEntries(config.exceptions)], violations };
});
