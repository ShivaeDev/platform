import { Effect, Path } from "effect";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

export const packageTests = Effect.fn("Tests.packageTests")(function* (inputs: RuleInputs) {
	const posix = yield* Path.Path.pipe(Effect.provide(Path.layer));
	const packages = [...(yield* workspacePackages(inputs))];
	if ((yield* readPackageManifest(inputs.readText, "package.json")) !== undefined) {
		packages.push({ directory: ".", name: "." });
	}
	const withSource = new Set(
		packages.filter((owner) => inputs.files.some((path) => path.startsWith(`${owner.directory === "." ? "" : `${owner.directory}/`}src/`))),
	);
	function sourcePath(path: string): string | undefined {
		const owner = packageOf(packages, path) ?? packages.find((candidate) => candidate.directory === ".");
		if (owner === undefined || !withSource.has(owner)) {
			return undefined;
		}
		const local = posix.relative(owner.directory, path);
		return local.startsWith("test/") ? posix.join(owner.directory, "src", local.slice("test/".length)) : undefined;
	}
	return { packages, sourcePath };
});
