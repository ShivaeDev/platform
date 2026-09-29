import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Schema } from "effect";
import ts from "typescript";
import { command, requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Array(Schema.String))));
export const checkBrowserEntries = (root: string, pkg: Package, consumer: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const entries = decode(yield* fs.readFileString(join(root, "script/package-check/browser-entries.json")));
		const seen = new Set<string>();
		const visit = (path: string): Effect.Effect<void, unknown, FileSystem.FileSystem> =>
			Effect.gen(function* () {
				if (seen.has(path)) return;
				seen.add(path);
				const source = yield* fs.readFileString(path);
				for (const { fileName } of ts.preProcessFile(source).importedFiles) {
					if (fileName.startsWith(".")) yield* visit(join(dirname(path), fileName));
					else yield* requireThat(fileName === "effect" || fileName.startsWith("effect/"), `${path}: browser entry imports ${fileName}`);
				}
			});
		for (const entry of entries[pkg.directory.split("/").at(-1) ?? ""] ?? []) {
			const specifier = pkg.manifest.name + entry.slice(1);
			const url = yield* command(consumer, "node", [
				"--input-type=module",
				"--eval",
				`console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
			]);
			yield* visit(fileURLToPath(url.trim()));
		}
	});
