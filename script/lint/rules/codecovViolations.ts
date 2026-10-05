import { committedComponents, components } from "#codecov/components.ts";
import type { Inventory } from "#lint/inventory.ts";
import type { Violation } from "#lint/violation.ts";
import { workspacePackages } from "#lint/workspace.ts";

export function codecovViolations(inventory: Inventory): readonly Violation[] {
	if (committedComponents(inventory.codecov) === components(workspacePackages(inventory))) {
		return [];
	}
	return [
		{
			file: "codecov.yml",
			line: undefined,
			message: "component_management does not list one component per workspace package. Run `pnpm codecov:components` and commit codecov.yml.",
			rule: "codecov/components",
		},
	];
}
