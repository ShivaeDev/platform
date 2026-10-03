import { basename, type Inventory, isDeclaration, type SourceFile } from "#lint/inventory.ts";
import type { Violation } from "#lint/violation.ts";
import { workspacePackages } from "#lint/workspace.ts";

const BARREL_FILE = /^index\.tsx?$/u;

const packageEntries = (inventory: Inventory): ReadonlySet<string> =>
	new Set(workspacePackages(inventory).flatMap(({ root }) => [`${root}/src/index.ts`, `${root}/src/index.tsx`]));

const barrelViolations = (file: SourceFile, entries: ReadonlySet<string>): readonly Violation[] =>
	!BARREL_FILE.test(basename(file.path)) || entries.has(file.path)
		? []
		: [
				{
					file: file.path,
					line: undefined,
					message:
						"index.ts barrels are banned outside the package entry (src/index.ts). Name the module after its purpose and import it explicitly.",
					rule: "structure/no-barrel",
				},
			];

export const structureViolations = (inventory: Inventory): readonly Violation[] => {
	const entries = packageEntries(inventory);
	return inventory.sources.filter((file) => !isDeclaration(file.path)).flatMap((file) => barrelViolations(file, entries));
};
