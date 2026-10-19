import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import type { BaselineEntry } from "#baseline/format.ts";
import { rewriteBaseline } from "#baseline/rewrite.ts";
import type { ResolvedConfig } from "#config/load.ts";
import { SetupFailure } from "#failure.ts";
import { orWhenAbsent, writeText } from "#inventory/filesystem.ts";

export const SHARD_NAME = "quality-baseline.jsonl";

export interface Shard {
	readonly entries: readonly BaselineEntry[];
	readonly raw: string;
}

export function shardOf(file: string, rootFile: string): string {
	const [folder, name, ...rest] = file.split("/");
	return folder === "packages" && name !== undefined && rest.length > 0 ? `packages/${name}/${SHARD_NAME}` : rootFile;
}

export const shardPaths = Effect.fn("Baseline.shardPaths")(function* (config: ResolvedConfig) {
	const fs = yield* FileSystem.FileSystem;
	const folder = join(config.root, "packages");
	const names = yield* orWhenAbsent(folder, fs.readDirectory(folder), []);
	const paths = [config.baseline];
	for (const name of names) {
		if ((yield* fs.stat(join(folder, name))).type === "Directory") {
			paths.push(`packages/${name}/${SHARD_NAME}`);
		}
	}
	return paths;
});

export const saveShards = Effect.fn("Baseline.saveShards")(
	function* (config: ResolvedConfig, before: ReadonlyMap<string, Shard>, entries: readonly BaselineEntry[]) {
		const fs = yield* FileSystem.FileSystem;
		const grouped = new Map<string, BaselineEntry[]>();
		for (const entry of entries) {
			const path = shardOf(entry.file, config.baseline);
			const group = grouped.get(path) ?? [];
			group.push(entry);
			grouped.set(path, group);
		}
		for (const path of new Set([...before.keys(), ...grouped.keys()])) {
			const old = before.get(path);
			const next = grouped.get(path) ?? [];
			if (next.length === 0) {
				if (old !== undefined) {
					yield* fs.remove(join(config.root, path));
				}
			} else {
				const text = rewriteBaseline(old?.raw, old?.entries ?? [], next);
				if (text !== old?.raw) {
					yield* writeText(join(config.root, path), text);
				}
			}
		}
	},
	Effect.mapError((failure) => new SetupFailure({ message: failure.message })),
);
