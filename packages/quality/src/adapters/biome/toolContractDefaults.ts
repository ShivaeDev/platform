import { dirname, join, relative, resolve } from "node:path";
import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { vitestContractPaths } from "#adapters/vitestContractPaths.ts";
import type { Diagnostic } from "#biome/report.ts";

export const toolContractDefaults = Effect.fn("Biome.toolContractDefaults")(function* (root: string, diagnostics: readonly Diagnostic[]) {
	const directories = new Set<string>();
	for (const diagnostic of diagnostics) {
		if (diagnostic.category !== "lint/style/noDefaultExport" || diagnostic.location.path === undefined) {
			continue;
		}
		let directory = dirname(relative(root, resolve(root, diagnostic.location.path)));
		while (!directories.has(directory)) {
			directories.add(directory);
			if (directory === ".") {
				break;
			}
			directory = dirname(directory);
		}
	}
	const readText = yield* manifestReader(root);
	const contracts = yield* Effect.forEach([...directories], (directory) =>
		Effect.promise(async () => {
			const manifest = await readPackageManifest(readText, join(directory, "package.json"));
			return vitestContractPaths(directory, manifest?.scripts ?? {}).map((path) => resolve(root, path));
		}),
	);
	return new Set(contracts.flat());
}, Effect.scoped);
