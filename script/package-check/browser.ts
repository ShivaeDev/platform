import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Schema } from "effect";
import ts from "typescript";
import { conditionalTarget, importEntry } from "#package-check/imports.ts";
import { command, requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Array(Schema.String))));
const BROWSER_CONDITIONS = ["browser", "import"];

function aliasTarget(pkg: Package, path: string, specifier: string): string | undefined {
	const installed = `/node_modules/${pkg.manifest.name}`;
	const target = conditionalTarget(importEntry(pkg.manifest.imports ?? {}, specifier), BROWSER_CONDITIONS);
	return target === undefined ? undefined : join(path.slice(0, path.lastIndexOf(installed) + installed.length), target);
}

function followed(pkg: Package, path: string, specifier: string): Effect.Effect<string | undefined, Error> {
	if (specifier.startsWith(".")) {
		return Effect.succeed(join(dirname(path), specifier));
	}
	if (specifier.startsWith("#")) {
		const target = aliasTarget(pkg, path, specifier);
		return target === undefined
			? Effect.fail(new Error(`${path}: browser entry imports ${specifier}, which no imports entry resolves`))
			: Effect.succeed(target);
	}
	return Effect.as(requireThat(specifier === "effect" || specifier.startsWith("effect/"), `${path}: browser entry imports ${specifier}`), undefined);
}

export const checkBrowserEntries = (root: string, pkg: Package, consumer: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const entries = decode(yield* fs.readFileString(join(root, "script/package-check/browser-entries.json")));
		const seen = new Set<string>();
		const visit = (path: string): Effect.Effect<void, unknown, FileSystem.FileSystem> =>
			Effect.gen(function* () {
				if (seen.has(path)) {
					return;
				}
				seen.add(path);
				const source = yield* fs.readFileString(path);
				for (const { fileName } of ts.preProcessFile(source).importedFiles) {
					const next = yield* followed(pkg, path, fileName);
					if (next !== undefined) {
						yield* visit(next);
					}
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
