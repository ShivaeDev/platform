import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path } from "effect";
import { setManifestFiles } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { typeScriptProgram } from "#adapters/typeScriptProgram.ts";
import { loadConfig, type ResolvedConfig } from "#config/load.ts";
import { type BaselineFile, readBaseline, readInput } from "#engine/baselineFile.ts";
import { runRules } from "#engine/runRules.ts";
import type { Violation } from "#engine/violation.ts";
import { biomeExceptions } from "#exceptions/biomeFindings.ts";
import type { RegistryEntry, StaleRegistryEntry } from "#exceptions/registry.ts";
import { registryEntries } from "#exceptions/registryEntries.ts";
import { SetupFailure } from "#failure.ts";
import { collectInventory, type Inventory } from "#inventory/collect.ts";
import type { RuleServices } from "#rule.ts";

export interface Session {
	readonly baseline: BaselineFile;
	readonly config: ResolvedConfig;
	readonly inventory: Inventory;
	readonly registry: readonly RegistryEntry[];
	readonly staleRegistry: readonly StaleRegistryEntry[];
	readonly violations: readonly Violation[];
}

function setup<TValue, TRequirements>(effect: Effect.Effect<TValue, Error, TRequirements>): Effect.Effect<TValue, SetupFailure, TRequirements> {
	return Effect.mapError(effect, (failure) =>
		failure instanceof SetupFailure ? failure : new SetupFailure({ cause: failure, message: failure.message }),
	);
}

export const scan = Effect.fn("Engine.scan")(function* (
	config: ResolvedConfig,
): Effect.fn.Return<Pick<Session, "inventory" | "staleRegistry" | "violations">, SetupFailure, RuleServices> {
	const { relative } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const inventory = yield* setup(collectInventory(config.root, config));
	const readText = yield* manifestReader(config.root);
	setManifestFiles(readText, inventory.manifestFiles);
	const inputs = {
		configFile: relative(config.root, config.file),
		entries: config.entries,
		exceptions: config.exceptions,
		files: inventory.files,
		nonEffectFolders: config.nonEffectFolders,
		readText,
		root: config.root,
		sources: inventory.sources,
		typeScript: yield* typeScriptProgram(config.root, inventory.sources),
	};
	const { kept, stale } = yield* setup(biomeExceptions(yield* runRules(config.active, inputs, config.skippedHalves), inputs, config.skippedHalves));
	return { inventory, staleRegistry: stale, violations: kept };
});

export type RunSet = "fast" | "full";

// A fast run leaves deep rules and deep halves out and sets aside the baseline entries and exceptions it cannot judge.
function selected(config: ResolvedConfig, set: RunSet): ResolvedConfig {
	if (set === "full") {
		return config;
	}
	const active = config.active.filter((rule) => rule.depth === "fast");
	return {
		...config,
		active,
		skipped: new Set(config.active.filter((rule) => rule.depth === "deep").map((rule) => rule.id)),
		skippedHalves: new Set(active.filter((rule) => rule.deepHalf !== undefined).map((rule) => rule.id)),
	};
}

export const openSession = Effect.fn("Engine.openSession")(function* (
	cwd: string,
	configPath: string | undefined,
	set: RunSet = "full",
): Effect.fn.Return<Session, SetupFailure, RuleServices> {
	const config = selected(yield* loadConfig(cwd, configPath), set);
	const selection = configPath === undefined ? "" : ` --config ${configPath}`;
	for (const path of new Set([config.registry, "quality/registry.json"])) {
		if ((yield* readInput(config.root, path)) !== undefined) {
			return yield* new SetupFailure({
				message: `${path} holds legacy exceptions. Run \`quality exceptions migrate${selection} --from ${path}\` to move them into ${config.file}.`,
			});
		}
	}
	const baseline = yield* readBaseline(config);
	const scanned = yield* scan(config);
	return { ...scanned, baseline, config, registry: registryEntries(config.exceptions) };
});
