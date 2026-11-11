import { baselineStory, setupRun } from "#test/baselineStory.ts";
import { writeAll } from "#test/recordedDebt.ts";
import { branchOff } from "#testing/adapters/git.ts";
import { formatTree } from "#testing/adapters/qualityTree.ts";
import { linkPackage, type SeedFile } from "#testing/adapters/tree.ts";

export const AWAIT = "await Promise.resolve();\n";
export const THROW = 'throw new Error("refused");\n';
export const HELPER_CALL = 'import { fail } from "./fail.ts";\n\nexport function stop() {\n\treturn fail();\n}\n';

function recordedOnMain(line: string, files: readonly SeedFile[]) {
	return baselineStory.trait("repository", line, function* (engine) {
		writeAll(engine.root, [
			{ content: "node_modules/\n", path: ".gitignore" },
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
			{ content: 'export default { sources: ["src"] };\n', path: "quality.config.ts" },
			...files,
		]);
		linkPackage(engine.root);
		formatTree(engine.root);
		yield* setupRun(engine, "baseline", "write");
		branchOff(engine.root);
	});
}

export function boundaryDebt() {
	return recordedOnMain("an await finding is recorded and committed on main", [{ content: AWAIT, path: "src/work.ts" }]);
}

export function typedBoundaryDebt() {
	return recordedOnMain("src/work.ts calls a throwing helper from src/fail.ts, and that typed finding is recorded and committed on main", [
		{ content: 'export function fail(): never {\n\tthrow new Error("failed");\n}\n', path: "src/fail.ts" },
		{ content: HELPER_CALL, path: "src/work.ts" },
	]);
}
