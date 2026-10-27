import { cpSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function supervisorBoardInstallation(source: string, installed: string, root: string) {
	const board = join(root, "board");
	mkdirSync(board);
	for (const file of ["src", "package.json", "vite.config.ts"]) {
		cpSync(join(source, file), join(board, file), { recursive: true });
	}
	const config = JSON.parse(readFileSync(join(source, "tsconfig.json"), "utf8"));
	writeFileSync(join(board, "tsconfig.json"), JSON.stringify({ ...config, extends: join(source, "../../tsconfig.base.json") }));
	symlinkSync(join(source, "node_modules"), join(board, "node_modules"));
	const modules = join(installed, "node_modules");
	mkdirSync(join(modules, "@shivaedev"), { recursive: true });
	for (const entry of readdirSync(join(source, "../work-fleet/node_modules"))) {
		if (entry !== "@shivaedev") {
			symlinkSync(realpathSync(join(source, "../work-fleet/node_modules", entry)), join(modules, entry));
		}
	}
	for (const entry of readdirSync(join(source, "../work-fleet/node_modules/@shivaedev"))) {
		symlinkSync(
			entry === "work-board" ? board : realpathSync(join(source, "../work-fleet/node_modules/@shivaedev", entry)),
			join(modules, "@shivaedev", entry),
		);
	}
	return board;
}
