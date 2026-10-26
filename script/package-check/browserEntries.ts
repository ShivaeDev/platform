import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Schema } from "effect";
import ts from "typescript";
import { browserEntries, dependencyEntry } from "#package-check/browserDependencies.ts";
import { conditionalTarget, importEntry } from "#package-check/imports.ts";
import { command } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Array(Schema.String))));
const BROWSER_CONDITIONS = ["browser", "import"];

function installedRoot(pkg: Package, path: string): string {
	const installed = `/node_modules/${pkg.manifest.name}`;
	return path.slice(0, path.lastIndexOf(installed) + installed.length);
}

function resolved(cwd: string, specifier: string) {
	return command(cwd, "node", ["--input-type=module", "--eval", `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`]).pipe(
		Effect.map((url) => fileURLToPath(url.trim())),
	);
}

export const checkBrowserEntries = Effect.fn("Packed.checkBrowserEntries")(function* (
	root: string,
	pkg: Package,
	packages: readonly Package[],
	consumer: string,
) {
	const fs = yield* FileSystem.FileSystem;
	const entries = decode(yield* fs.readFileString(join(root, "script/package-check/browser-entries.json")));
	const seen = new Set<string>();
	function followed(owner: Package, path: string, specifier: string): Effect.Effect<readonly [Package, string] | undefined, Error> {
		if (specifier.startsWith(".")) {
			return Effect.succeed([owner, join(dirname(path), specifier)]);
		}
		if (specifier.startsWith("#")) {
			const target = conditionalTarget(importEntry(owner.manifest.imports ?? {}, specifier), BROWSER_CONDITIONS);
			return target === undefined
				? Effect.fail(new Error(`${path}: browser entry imports ${specifier}, which no imports entry resolves`))
				: Effect.succeed([owner, join(installedRoot(owner, path), target)]);
		}
		if (specifier === "effect" || specifier.startsWith("effect/")) {
			return Effect.succeed(undefined);
		}
		const dependency = dependencyEntry(owner, packages, entries, specifier);
		return dependency === undefined
			? Effect.fail(new Error(`${path}: browser entry imports ${specifier}`))
			: Effect.map(resolved(installedRoot(owner, path), specifier), (target) => [dependency, target] as const);
	}
	function visit(owner: Package, path: string): Effect.Effect<void, unknown, FileSystem.FileSystem> {
		return Effect.gen(function* () {
			if (seen.has(path)) {
				return;
			}
			seen.add(path);
			const source = yield* fs.readFileString(path);
			for (const { fileName } of ts.preProcessFile(source).importedFiles) {
				const next = yield* followed(owner, path, fileName);
				if (next !== undefined) {
					yield* visit(...next);
				}
			}
		});
	}
	for (const entry of browserEntries(entries, pkg)) {
		yield* visit(pkg, yield* resolved(consumer, pkg.manifest.name + entry.slice(1)));
	}
});
