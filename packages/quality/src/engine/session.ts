import { resolve } from "node:path";
import { Effect, type FileSystem } from "effect";
import { loadConfig, type ResolvedConfig } from "../config/load.ts";
import { validOrFail } from "../decoded.ts";
import { decodeRegistry, type RegistryEntry } from "../exceptions/registry.ts";
import { SetupFailure } from "../failure.ts";
import { collectInventory, type Inventory } from "../inventory/collect.ts";
import { type FilesystemFailure, readOptionalText } from "../inventory/filesystem.ts";
import { type BaselineFile, readBaseline, readInput } from "./baseline-file.ts";
import { runRules } from "./run-rules.ts";
import type { Violation } from "./violation.ts";

export interface Session {
	readonly baseline: BaselineFile;
	readonly config: ResolvedConfig;
	readonly inventory: Inventory;
	readonly registry: readonly RegistryEntry[];
	readonly violations: readonly Violation[];
}

const setup = <Value, Requirements>(
	effect: Effect.Effect<Value, FilesystemFailure, Requirements>,
): Effect.Effect<Value, SetupFailure, Requirements> => Effect.mapError(effect, (failure) => new SetupFailure({ message: failure.message }));

export const scan = (config: ResolvedConfig): Effect.Effect<Pick<Session, "inventory" | "violations">, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const inventory = yield* setup(collectInventory(config.root, config));
		const services = yield* Effect.context<FileSystem.FileSystem>();
		const readText = (path: string): Promise<string | undefined> => Effect.runPromiseWith(services)(readOptionalText(resolve(config.root, path)));
		const violations = yield* runRules(config.active, { files: inventory.files, readText, root: config.root, sources: inventory.sources });
		return { inventory, violations };
	});

export const openSession = (cwd: string, configPath: string | undefined): Effect.Effect<Session, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const config = yield* loadConfig(cwd, configPath);
		const registryRaw = yield* readInput(config.root, config.registry);
		const registry = yield* validOrFail(config.registry, yield* Effect.promise(() => decodeRegistry(registryRaw)));
		const baseline = yield* readBaseline(config);
		const { inventory, violations } = yield* scan(config);
		return { baseline, config, inventory, registry, violations };
	});
