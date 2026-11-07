import { Effect, Path } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { scriptPaths } from "#adapters/scriptPaths.ts";
import { isTooling } from "#imports/isTooling.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

export const developmentCode = Effect.fn("Naming.developmentCode")(function* (inputs: RuleInputs) {
	const posix = yield* Path.Path.pipe(Effect.provide(Path.layer));
	const packages = yield* Effect.promise(() => workspacePackages(inputs));
	const scripts = yield* Effect.forEach([".", ...packages.map((owner) => owner.directory)], (directory) =>
		Effect.promise(() => readPackageManifest(inputs.readText, posix.join(directory, "package.json"))).pipe(
			Effect.map((manifest) => scriptPaths(directory, manifest?.scripts ?? {})),
		),
	);
	const scripted = new Set(scripts.flat());
	return (path: string) => {
		const directory = packageOf(packages, path)?.directory ?? ".";
		return isTooling(directory, path) || (!posix.relative(directory, path).includes("/") && scripted.has(path));
	};
});
