import { baselineStory, setupRun } from "#test/baselineStory.ts";
import { writeAll } from "#test/recordedDebt.ts";
import { branchOff } from "#testing/adapters/git.ts";
import { formatTree } from "#testing/adapters/qualityTree.ts";
import { linkPackage } from "#testing/adapters/tree.ts";

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
