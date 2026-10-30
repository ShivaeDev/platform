import { posix } from "node:path";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";
import type { RuleInputs } from "#rule.ts";

const DEPENDENCIES = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function storyPrerequisites(inputs: RuleInputs, packages: readonly WorkspacePackage[]): Promise<ReadonlySet<string>> {
	const root = (await readPackageManifest(inputs.readText, "package.json")) ?? {};
	const members = typeof root.name === "string" ? [...packages, { directory: "", name: root.name }] : packages;
	const byName = new Map(members.map((member) => [member.name, member]));
	const pending = ["@shivaedev/test-story"];
	const directories = new Set<string>();
	while (pending.length > 0) {
		const current = byName.get(pending.pop() ?? "");
		if (current === undefined || directories.has(current.directory)) {
			continue;
		}
		directories.add(current.directory);
		const value = (await readPackageManifest(inputs.readText, posix.join(current.directory, "package.json"))) ?? {};
		for (const key of DEPENDENCIES) {
			const dependencies = value[key];
			if (object(dependencies)) {
				pending.push(...Object.keys(dependencies).filter((name) => byName.has(name)));
			}
		}
	}
	return directories;
}
