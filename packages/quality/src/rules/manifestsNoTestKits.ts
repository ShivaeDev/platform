import { Effect } from "effect";
import { manifestFiles, readPackageManifest } from "#adapters/manifestInventory.ts";
import { exportedModule, exportTargets } from "#imports/packageExports.ts";
import { SHIPPED_FIELDS } from "#manifests/entryPoints.ts";
import { isTestCode } from "#naming/testName.ts";
import type { PackageManifest } from "#PackageManifest.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";

const TEST_PACKAGES = new Set(["@shivaedev/test", "@shivaedev/test-story", "@shivaedev/test-sql", "@shivaedev/test-kits", "vitest"]);

function testingModule(path: string): boolean {
	return isTestCode(path) || /(?:^|\/)(?:testing|test-support)(?:\/|\.|$)/u.test(path);
}

function testingExports(exports: unknown): readonly string[] {
	if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
		return exportTargets(exports).filter(testingModule);
	}
	return Object.entries(exports).flatMap(([key, value]) => {
		const targets = exportTargets(value);
		if (targets.length === 0) {
			return [];
		}
		return testingModule(key) ? [key] : targets.filter(testingModule);
	});
}

function findingsIn(inputs: RuleInputs, path: string, manifest: PackageManifest): readonly Finding[] {
	if (manifest.private === true || TEST_PACKAGES.has(manifest.name ?? "") || manifest.name === "@shivaedev/vitest-rerun") {
		return [];
	}
	const directory = path.slice(0, -"package.json".length);
	const modules = inputs.files
		.filter((file) => file.startsWith(directory))
		.map((file) => file.slice(directory.length))
		.filter((file) => /(?:^|\/)testing(?:\/|\.|$)/u.test(file) && exportedModule(manifest.exports, file));
	const main = manifest.main !== undefined && testingModule(manifest.main) ? [manifest.main] : [];
	const exports = [...new Set([...testingExports(manifest.exports), ...main, ...modules])];
	const name = manifest.name ?? path;
	const repair = "Move the helper into @shivaedev/test-kits and keep test dependencies in devDependencies.";
	return [
		...(exports.length === 0
			? []
			: [{ file: path, message: `Runtime package "${name}" publishes testing modules: ${exports.join(", ")}. ${repair}`, subject: "exports" }]),
		...SHIPPED_FIELDS.flatMap((field) =>
			Object.keys(manifest[field] ?? {})
				.filter((dependency) => TEST_PACKAGES.has(dependency))
				.map((dependency) => ({
					file: path,
					message: `Runtime package "${name}" declares test package "${dependency}" in ${field}. ${repair}`,
					subject: `${field}.${dependency}`,
				})),
		),
	];
}

export const manifestsNoTestKits = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const findings = yield* Effect.forEach(manifestFiles(inputs), (path) =>
				Effect.map(
					Effect.promise(() => readPackageManifest(inputs.readText, path)),
					(manifest) => (manifest === undefined ? [] : findingsIn(inputs, path, manifest)),
				),
			);
			return findings.flat();
		}),
	description: "Runtime packages publish no testing modules and ship no test-package dependencies or peers. Move reusable helpers into test-kits.",
	id: "manifests/no-test-kits",
	registrable: false,
});
