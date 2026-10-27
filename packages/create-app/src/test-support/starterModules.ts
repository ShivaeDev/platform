import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function starterModules() {
	const modules = fileURLToPath(new URL("../../../../examples/starter/node_modules", import.meta.url));
	if (!existsSync(modules)) {
		throw new Error("Install workspace dependencies before linking examples/starter/node_modules");
	}
	return modules;
}

// The starter reaches the pieces platform brings through the workspace root's publicHoistPattern, so a generated app outside the workspace needs them beside its own modules.
export function hoistedPieces() {
	return fileURLToPath(new URL("../../../../node_modules/@shivaedev", import.meta.url));
}

export function linkStarterModules(app: string) {
	const modules = starterModules();
	const target = join(app, "node_modules");
	mkdirSync(join(target, "@shivaedev"), { recursive: true });
	for (const name of readdirSync(modules)) {
		if (name !== "@shivaedev") {
			symlinkSync(join(modules, name), join(target, name));
		}
	}
	for (const scope of [join(modules, "@shivaedev"), hoistedPieces()]) {
		for (const name of readdirSync(scope)) {
			if (!existsSync(join(target, "@shivaedev", name))) {
				symlinkSync(realpathSync(join(scope, name)), join(target, "@shivaedev", name));
			}
		}
	}
}
