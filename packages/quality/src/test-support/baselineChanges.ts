import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { trees } from "./cli.ts";
import { qualityTree } from "./qualityTree.ts";

export function growLongerFile(root: string): void {
	appendFileSync(join(root, "src/longer.ts"), "String(7);\n");
}

export function addUnbaselinedFile(root: string): void {
	writeFileSync(join(root, "src/new.ts"), "String(1);\nString(2);\nString(3);\nString(4);\nString(5);\n");
}

export function reduceLongFile(root: string): void {
	writeFileSync(join(root, "src/long.ts"), "String(0);\n");
}

export function reduceLongerFile(root: string): void {
	writeFileSync(join(root, "src/longer.ts"), "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\n");
}

export function legacyBaselineRepository(): string {
	const legacy = { "src/long.ts": { count: 1, measure: 4 }, "src/longer.ts": { count: 1, measure: 7 }, "src/short.ts": { count: 1, measure: 5 } };
	return qualityTree(trees.dirty, [{ content: JSON.stringify({ "structure/max-lines": legacy }), path: "quality/baseline.json" }]);
}

export function exceedLongerBaseline(root: string): void {
	writeFileSync(join(root, "src/longer.ts"), "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\nString(5);\nString(6);\n");
}
