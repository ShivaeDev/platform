import { basename, type Inventory, isDeclaration, type SourceFile } from "#lint/inventory.ts";
import type { Violation } from "#lint/violation.ts";

const BARREL_FILE = /^index\.tsx?$/u;

function barrelViolations(file: SourceFile): readonly Violation[] {
	return BARREL_FILE.test(basename(file.path))
		? [
				{
					file: file.path,
					line: undefined,
					message: "index.ts barrels are banned. Name the module after its purpose; consumers import it through the package's ./*.ts export.",
					rule: "structure/no-barrel",
				},
			]
		: [];
}

export function structureViolations(inventory: Inventory): readonly Violation[] {
	return inventory.sources.filter((file) => !isDeclaration(file.path)).flatMap(barrelViolations);
}
