import { join, resolve } from "node:path";
import { Effect, type FileSystem } from "effect";
import { type BaselineEntry, decodeBaseline } from "../baseline/format.ts";
import { loadConfig, type ResolvedConfig } from "../config/load.ts";
import { validOrFail } from "../decoded.ts";
import { decodeRegistry, type RegistryEntry } from "../exceptions/registry.ts";
import { SetupFailure } from "../failure.ts";
import { collectInventory, type Inventory } from "../inventory/collect.ts";
import { type FilesystemFailure, readOptionalText } from "../inventory/filesystem.ts";
import { runRules } from "./run-rules.ts";
import type { Violation } from "./violation.ts";

export interface Session {
	readonly config: ResolvedConfig;
	readonly inventory: Inventory;
	readonly violations: ReadonlyArray<Violation>;
	readonly registry: ReadonlyArray<RegistryEntry>;
	readonly baseline: { readonly raw: string | undefined; readonly entries: ReadonlyArray<BaselineEntry> };
}

const setup = <Value, Requirements>(
	effect: Effect.Effect<Value, FilesystemFailure, Requirements>,
): Effect.Effect<Value, SetupFailure, Requirements> => Effect.mapError(effect, (failure) => new SetupFailure({ message: failure.message }));

const readInput = (root: string, path: string): Effect.Effect<string | undefined, SetupFailure, FileSystem.FileSystem> =>
	setup(readOptionalText(join(root, path)));

export const openSession = (cwd: string, configPath: string | undefined): Effect.Effect<Session, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const config = yield* loadConfig(cwd, configPath);
		const inventory = yield* setup(collectInventory(config.root, config));
		const registryRaw = yield* readInput(config.root, config.registry);
		const registry = yield* validOrFail(config.registry, yield* Effect.promise(() => decodeRegistry(registryRaw)));
		const baselineRaw = yield* readInput(config.root, config.baseline);
		const baseline = yield* validOrFail(config.baseline, yield* Effect.promise(() => decodeBaseline(baselineRaw)));
		const services = yield* Effect.context<FileSystem.FileSystem>();
		const readText = (path: string): Promise<string | undefined> => Effect.runPromiseWith(services)(readOptionalText(resolve(config.root, path)));
		const violations = yield* runRules(config.active, { files: inventory.files, readText, root: config.root, sources: inventory.sources });
		return { baseline: { entries: baseline, raw: baselineRaw }, config, inventory, registry, violations };
	});
