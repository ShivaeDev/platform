import { posix } from "node:path";
import { Effect } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { isTooling } from "#imports/isTooling.ts";
import { entryPointsOf, isApplication, provider } from "#manifests/entryPoints.ts";
import { isTestCode } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import type { Diagnostic } from "./report.ts";

const UNDECLARED = "lint/correctness/noUndeclaredDependencies";

const DEPENDENCY = /^Dependency (?<name>\S+) isn't specified in /u;

const ownerOf = Effect.fn("Biome.ownerOf")(function* (inputs: Pick<RuleInputs, "readText">, path: string) {
	let directory = posix.dirname(path);
	for (;;) {
		const file = posix.join(directory, "package.json");
		const manifest = yield* Effect.promise(() => readPackageManifest(inputs.readText, file));
		if (manifest !== undefined || directory === ".") {
			return { directory, manifest };
		}
		directory = posix.dirname(directory);
	}
});

const brought = Effect.fn("Biome.brought")(function* (inputs: Pick<RuleInputs, "readText">, diagnostic: Diagnostic) {
	const name = DEPENDENCY.exec(diagnostic.message)?.groups?.name;
	const path = diagnostic.location.path;
	if (diagnostic.category !== UNDECLARED || name === undefined || path === undefined) {
		return false;
	}
	const owner = yield* ownerOf(inputs, path);
	if (!isApplication(owner.manifest)) {
		return false;
	}
	const entryPoints = yield* Effect.promise(() => entryPointsOf(inputs, owner.directory, owner.manifest, new Map()));
	const development = isTestCode(path) || isTooling(owner.directory, path);
	return provider(entryPoints, name, development, true) !== undefined;
});

export const withoutEntryPointImports = Effect.fn("Biome.withoutEntryPointImports")(function* (
	inputs: Pick<RuleInputs, "readText">,
	diagnostics: readonly Diagnostic[],
) {
	const covered = yield* Effect.forEach(diagnostics, (diagnostic) => brought(inputs, diagnostic), { concurrency: "unbounded" });
	return diagnostics.filter((_, index) => !covered[index]);
});
