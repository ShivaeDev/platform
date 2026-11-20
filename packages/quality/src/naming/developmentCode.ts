import { Effect, Path } from "effect";
import { isTooling } from "#imports/isTooling.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import { readPackageManifest } from "#manifestInventory.ts";
import type { RuleInputs } from "#rule.ts";
import { scriptPaths } from "#scriptPaths.ts";

export const developmentCode = Effect.fn("Naming.developmentCode")(function* (inputs: RuleInputs) {
	const posix = yield* Path.Path.pipe(Effect.provide(Path.layer));
	const packages = yield* workspacePackages(inputs);
	const scripts = yield* Effect.forEach([".", ...packages.map((owner) => owner.directory)], (directory) =>
		readPackageManifest(inputs.readText, posix.join(directory, "package.json")).pipe(
			Effect.map((manifest) => scriptPaths(directory, manifest?.scripts ?? {})),
		),
	);
	const scripted = new Set(scripts.flat());
	return (path: string) => {
		const directory = packageOf(packages, path)?.directory ?? ".";
		return isTooling(directory, path) || (!posix.relative(directory, path).includes("/") && scripted.has(path));
	};
});
