import { Effect, Path } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { importGraph } from "#imports/graph.ts";
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
	const privatePackages = yield* Effect.forEach(trees.packages, (owner) =>
		Effect.map(
			Effect.promise(() => readPackageManifest(inputs.readText, posix.join(owner.directory, "package.json"))),
			(manifest) => (manifest?.private === true && manifest.bin === undefined && owner.directory !== "." ? [owner] : []),
		),
	);
	if (privatePackages.flat().length === 0 || !inputs.sources.some((file) => /\.[cm]?[jt]sx?$/u.test(file.path))) {
		return testFile;
	}
	const graph = yield* importGraph(inputs);
	const directories = new Set(privatePackages.flat().map((owner) => owner.directory));
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
