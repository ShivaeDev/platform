import { join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { loadConfig } from "#config/load.ts";
import { validOrFail } from "#decoded.ts";
import { readInput } from "#engine/baselineFile.ts";
import { decodeExceptions, type ExceptionDeclaration } from "#exceptions/declaration.ts";
import { migrateBiome } from "#exceptions/migrateBiome.ts";
import { migrateConfig } from "#exceptions/migrateConfig.ts";
import { decodeRegistry } from "#exceptions/registry.ts";
import { SetupFailure } from "#failure.ts";
import { writeText } from "#inventory/filesystem.ts";

function merge(entries: readonly ExceptionDeclaration[]): readonly ExceptionDeclaration[] {
	const merged: ExceptionDeclaration[] = [];
	for (const entry of entries) {
		const index = merged.findIndex(
			(other) =>
				other.reason === entry.reason
				&& other.subject === entry.subject
				&& other.files.length === entry.files.length
				&& other.files.every((file) => entry.files.includes(file)),
		);
		const previous = merged[index];
		if (previous === undefined) {
			merged.push(entry);
		} else {
			merged[index] = {
				...previous,
				rules: [previous.rules[0], ...new Set([...previous.rules.slice(1), ...entry.rules.filter((rule) => rule !== previous.rules[0])])],
			};
		}
	}
	return merged;
}

export const migrateExceptions = Effect.fnUntraced(function* (
	cwd: string,
	configPath: string | undefined,
	from: string | undefined,
): Effect.fn.Return<void, SetupFailure, FileSystem.FileSystem> {
	const config = yield* loadConfig(cwd, configPath);
	const registryPath = from ?? config.registry;
	const raw = yield* readInput(config.root, registryPath);
	if (from !== undefined && raw === undefined) {
		return yield* new SetupFailure({ message: `${registryPath} does not exist. Pass an existing registry file with --from.` });
	}
	const registry = yield* validOrFail(registryPath, yield* Effect.promise(() => decodeRegistry(raw)));
	const entries = merge([
		...config.exceptions,
		...registry.map(
			({ file, reason, rule, subject }): ExceptionDeclaration => ({
				files: [file],
				reason,
				rules: [rule],
				...(subject === undefined ? {} : { subject }),
			}),
		),
		...config.biomeDeclarations.map(({ includes, reason, rule }): ExceptionDeclaration => ({ files: includes, reason, rules: [`biome/${rule}`] })),
	]);
	yield* validOrFail(config.file, yield* Effect.promise(() => decodeExceptions(entries)));
	const text = yield* readInput("", config.file);
	const next = yield* Effect.try({
		catch: (cause) => new SetupFailure({ message: String(cause) }),
		try: () => migrateConfig(text, config.file, entries, config.biomeDeclarations.length > 0),
	});
	const updates: Array<{ readonly path: string; readonly text: string }> = [{ path: config.file, text: next }];
	if (config.biomeDeclarations.length > 0) {
		for (const file of ["biome.json", "biome.jsonc"]) {
			const biome = yield* readInput(config.root, file);
			if (biome !== undefined) {
				const updated = yield* Effect.try({
					catch: (cause) => new SetupFailure({ message: String(cause) }),
					try: () => migrateBiome(biome, file, config.biomeDeclarations),
				});
				updates.push({ path: join(config.root, file), text: updated });
			}
		}
	}
	for (const update of updates) {
		yield* writeText(update.path, update.text).pipe(Effect.mapError((failure) => new SetupFailure({ message: failure.message })));
	}
	if (raw !== undefined) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(join(config.root, registryPath)).pipe(Effect.mapError((failure) => new SetupFailure({ message: failure.message })));
	}
	yield* Console.log(`quality: moved exceptions to ${config.file}. Run quality fix and review the changes; remove unused declaration imports.`);
});
