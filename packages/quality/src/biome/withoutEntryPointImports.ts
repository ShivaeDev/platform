import { posix } from "node:path";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { isTooling } from "#imports/isTooling.ts";
import { entryPointsOf, isApplication, provider } from "#manifests/entryPoints.ts";
import { isTestCode } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import type { Diagnostic } from "./report.ts";

const UNDECLARED = "lint/correctness/noUndeclaredDependencies";

const DEPENDENCY = /^Dependency (?<name>\S+) isn't specified in /u;

async function ownerOf(readText: RuleInputs["readText"], path: string) {
	let directory = posix.dirname(path);
	for (;;) {
		const manifest = await readPackageManifest(readText, posix.join(directory, "package.json"));
		if (manifest !== undefined || directory === ".") {
			return { directory, manifest };
		}
		directory = posix.dirname(directory);
	}
}

async function brought(readText: RuleInputs["readText"], diagnostic: Diagnostic): Promise<boolean> {
	const name = DEPENDENCY.exec(diagnostic.message)?.groups?.name;
	const path = diagnostic.location.path;
	if (diagnostic.category !== UNDECLARED || name === undefined || path === undefined) {
		return false;
	}
	const owner = await ownerOf(readText, path);
	if (!isApplication(owner.manifest)) {
		return false;
	}
	const entryPoints = await entryPointsOf({ readText }, owner.directory, owner.manifest, new Map());
	const development = isTestCode(path) || isTooling(owner.directory, path);
	return provider(entryPoints, name, development, true) !== undefined;
}

export async function withoutEntryPointImports(readText: RuleInputs["readText"], diagnostics: readonly Diagnostic[]): Promise<readonly Diagnostic[]> {
	const covered = await Promise.all(diagnostics.map((diagnostic) => brought(readText, diagnostic)));
	return diagnostics.filter((_, index) => !covered[index]);
}
