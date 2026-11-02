import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceBin } from "./sourceBin.ts";

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
		if (name !== "@shivaedev" && name !== ".bin") {
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
	const bin = join(target, ".bin");
	mkdirSync(bin);
	for (const name of readdirSync(join(modules, ".bin"))) {
		if (!["heavy-lock", "vitest-rerun"].includes(name)) {
			symlinkSync(join(modules, ".bin", name), join(bin, name));
		}
	}
	for (const name of ["heavy-lock", "vitest-rerun"]) {
		writeFileSync(join(bin, name), sourceBin(fileURLToPath(new URL(`../../../${name}/src/cli.ts`, import.meta.url))), { mode: 0o755 });
	}
}
