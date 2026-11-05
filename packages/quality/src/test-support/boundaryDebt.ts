import { formatTree } from "@shivaedev/test-kits/quality/adapters/formatTree.ts";
import { branchOff } from "@shivaedev/test-kits/quality/adapters/git.ts";
import { linkPackage } from "@shivaedev/test-kits/quality/adapters/tree.ts";
import { baselineStory, setupRun } from "./baselineStory.ts";
import { writeAll } from "./recordedDebt.ts";

export const AWAIT = "await Promise.resolve();\n";
export const THROW = 'throw new Error("refused");\n';

export function boundaryDebt() {
	return baselineStory.trait("repository", "an await finding is recorded and committed on main", function* (engine) {
		writeAll(engine.root, [
			{ content: "node_modules/\n", path: ".gitignore" },
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
			{ content: 'export default { sources: ["src"] };\n', path: "quality.config.ts" },
			{ content: AWAIT, path: "src/work.ts" },
		]);
		linkPackage(engine.root);
		formatTree(engine.root);
		yield* setupRun(engine, "baseline", "write");
		branchOff(engine.root);
	});
}
