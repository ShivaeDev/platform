import type { BaselineEntry } from "#baseline/format.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { writeAll, writeShards } from "#test/recordedDebt.ts";
import { branchOff } from "#testing/adapters/git.ts";
import { linkPackage, type SeedFile } from "#testing/adapters/tree.ts";

export const AWAIT = "await Promise.resolve();\n";
export const THROW = 'throw new Error("refused");\n';
export const HELPER_CALL = 'import { fail } from "./fail.ts";\n\nexport function stop() {\n\treturn fail();\n}\n';

function recordedOnMain(line: string, files: readonly SeedFile[], debt: readonly BaselineEntry[]) {
	return baselineStory.trait("repository", line, (engine) => {
		writeAll(engine.root, [
			{ content: "node_modules/\n", path: ".gitignore" },
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
			{ content: 'export default { sources: ["src"] };\n', path: "quality.config.ts" },
			...files,
		]);
		linkPackage(engine.root);
		writeShards(engine.root, debt);
		branchOff(engine.root);
	});
}

export function boundaryDebt() {
	return recordedOnMain(
		"an await finding is recorded as quality baseline write records it and committed on main",
		[{ content: AWAIT, path: "src/work.ts" }],
		[{ count: 1, deep: 0, file: "src/work.ts", rule: "effect/boundary" }],
	);
}

export function typedBoundaryDebt() {
	return recordedOnMain(
		"src/work.ts calls a throwing helper from src/fail.ts, and every finding of both files, that typed one among them, is recorded as quality baseline write records it and committed on main",
		[
			{ content: 'export function fail(): never {\n\tthrow new Error("failed");\n}\n', path: "src/fail.ts" },
			{ content: HELPER_CALL, path: "src/work.ts" },
		],
		[
			{ count: 1, deep: 0, file: "src/fail.ts", rule: "effect/boundary" },
			{ count: 1, deep: 1, file: "src/work.ts", rule: "effect/boundary" },
			{ count: 1, file: "src/work.ts", rule: "files/named-after-export" },
			{ count: 1, file: "src/work.ts", rule: "imports/aliased" },
			{ count: 1, file: "src/work.ts", rule: "structure/no-barrel" },
		],
	);
}
