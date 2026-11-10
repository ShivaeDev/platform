import { Effect } from "effect";
import type { WorkspacePackage } from "#imports/workspace.ts";
import { readPackageManifest } from "#manifestInventory.ts";
import type { RuleInputs } from "#rule.ts";

const PREREQUISITES = new Set(["@shivaedev/test-story", "@shivaedev/test", "@shivaedev/types"]);

export const storyPrerequisites = Effect.fn("Stories.storyPrerequisites")(function* (inputs: RuleInputs, packages: readonly WorkspacePackage[]) {
	const root = yield* readPackageManifest(inputs.readText, "package.json");
	const directories = packages.filter((member) => PREREQUISITES.has(member.name)).map((member) => member.directory);
	if (typeof root?.name === "string" && PREREQUISITES.has(root.name)) {
		directories.push("");
	}
	return new Set(directories);
});
