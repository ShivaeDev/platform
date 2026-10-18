import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runQuality, trees } from "#test/cli.ts";
import { branchOff } from "#test/git.ts";
import { qualityTree } from "#test/qualityTree.ts";

export function baseline(root: string): string {
	return readFileSync(join(root, "quality/baseline.jsonl"), "utf8");
}

export async function shrunkTwice(): Promise<string> {
	const root = qualityTree(trees.dirty);
	await runQuality(root, "baseline", "write");
	branchOff(root);
	writeFileSync(join(root, "src/long.ts"), "String(1);\n");
	writeFileSync(join(root, "src/longer.ts"), "String(1);\nString(2);\nString(3);\nString(4);\nString(5);\n");
	return root;
}
