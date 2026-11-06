import { Effect, Path } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { scriptPaths } from "#adapters/scriptPaths.ts";
import { importGraph } from "#imports/graph.ts";
import { isTooling } from "#imports/isTooling.ts";
import { testComposition } from "#imports/testComposition.ts";
import { packageOf } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";
import { packageTests } from "./packageTests.ts";
import { isTestCode } from "./testName.ts";

export const testCode = Effect.fn("Tests.testCode")(function* (inputs: RuleInputs) {
	const posix = yield* Path.Path.pipe(Effect.provide(Path.layer));
	const trees = yield* packageTests(inputs);
	function testFile(path: string) {
		return isTestCode(path) || trees.sourcePath(path) !== undefined;
	}
	const policies = yield* Effect.forEach(trees.packages, (owner) =>
		Effect.map(
			Effect.promise(() => readPackageManifest(inputs.readText, posix.join(owner.directory, "package.json"))),
			(manifest) => ({
				owner,
				private: manifest?.private === true && manifest.bin === undefined && owner.directory !== ".",
				scripts: scriptPaths(
					owner.directory,
					Object.fromEntries(Object.entries(manifest?.scripts ?? {}).filter(([name]) => !/^test(?::|$)/u.test(name))),
				),
			}),
		),
	);
	if (!(policies.some((policy) => policy.private) && inputs.sources.some((file) => /\.[cm]?[jt]sx?$/u.test(file.path)))) {
		return testFile;
	}
	const graph = yield* importGraph(inputs);
	const directories = new Set(policies.filter((policy) => policy.private).map((policy) => policy.owner.directory));
	const scripted = new Set(policies.flatMap((policy) => policy.scripts));
	for (const path of graph.modules) {
		const owner = packageOf(graph.packages, path);
		if (owner === undefined) {
			continue;
		}
		const built = posix.join(
			owner.directory,
			posix
				.relative(owner.directory, path)
				.replace(/^src\//u, "dist/")
				.replace(/\.(?<mode>[cm]?)tsx?$/u, ".$<mode>js"),
		);
		if (!(testFile(path) || isTooling(owner.directory, path)) && (scripted.has(path) || scripted.has(built))) {
			directories.delete(owner.directory);
		}
	}
	const composition = testComposition(
		graph,
		graph.packages.filter((owner) => directories.has(owner.directory)),
		testFile,
	);
	return (path: string) => {
		const owner = packageOf(graph.packages, path);
		return testFile(path) || (owner !== undefined && composition.has(owner));
	};
});
