import { relative } from "node:path";
import { Effect, type Scope } from "effect";
import { setManifestFiles } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { loadConfig, type ResolvedConfig } from "#config/load.ts";
import { staleBiomeExceptions } from "#exceptions/biomeFindings.ts";
import type { RegistryEntry, StaleRegistryEntry } from "#exceptions/registry.ts";
import { registryEntries } from "#exceptions/registryEntries.ts";
import { SetupFailure } from "#failure.ts";
import { collectInventory, type Inventory } from "#inventory/collect.ts";
import type { RuleServices } from "#rule.ts";
import { type BaselineFile, readBaseline, readInput } from "./baselineFile.ts";
import { runRules } from "./runRules.ts";
import type { Violation } from "./violation.ts";

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
): Effect.fn.Return<Pick<Session, "inventory" | "staleRegistry" | "violations">, SetupFailure, RuleServices | Scope.Scope> {
	const inventory = yield* setup(collectInventory(config.root, config));
	const readText = yield* manifestReader(config.root);
	setManifestFiles(readText, inventory.manifestFiles);
	const inputs = {
		configFile: relative(config.root, config.file),
		exceptions: config.exceptions,
		files: inventory.files,
		readText,
		root: config.root,
		sources: inventory.sources,
	};
	const violations = yield* runRules(config.active, inputs);
	const staleRegistry = yield* setup(staleBiomeExceptions(inputs));
	return { inventory, staleRegistry, violations };
}, Effect.scoped);

export const openSession = Effect.fn("Engine.openSession")(function* (
	cwd: string,
	configPath: string | undefined,
): Effect.fn.Return<Session, SetupFailure, RuleServices> {
	const config = yield* loadConfig(cwd, configPath);
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
