import { readPackageManifest } from "#adapters/manifestInventory.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

const PREREQUISITES = new Set(["@shivaedev/test-story", "@shivaedev/test", "@shivaedev/types"]);

export async function storyPrerequisites(inputs: RuleInputs, packages: readonly WorkspacePackage[]): Promise<ReadonlySet<string>> {
	const root = await readPackageManifest(inputs.readText, "package.json");
	const directories = packages.filter((member) => PREREQUISITES.has(member.name)).map((member) => member.directory);
	if (typeof root?.name === "string" && PREREQUISITES.has(root.name)) {
		directories.push("");
	}
	return new Set(directories);
}
