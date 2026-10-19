import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runQuality, trees } from "#test/cli.ts";
import { branchOff, commitAll, git } from "#test/git.ts";
import { qualityTree } from "#test/qualityTree.ts";
import { linkPackage, seedTree } from "#test/tree.ts";

export async function baselined(): Promise<string> {
	const root = qualityTree(trees.dirty);
	await runQuality(root, "baseline", "write");
	return branchOff(root);
}

export function baseline(root: string): string {
	return readFileSync(join(root, "quality-baseline.jsonl"), "utf8");
}

export async function shallowClone(): Promise<{ readonly clone: string; readonly origin: string }> {
	const origin = await baselined();
	for (const content of ["String(2);\n", "String(3);\n", "String(4);\n"]) {
		writeFileSync(join(origin, "src/short.ts"), content);
		commitAll(origin, "Work");
	}
	git(origin, "switch", "--quiet", "main");
	writeFileSync(join(origin, "src/main.ts"), "String(1);\n");
	commitAll(origin, "Main moves on");
	git(origin, "switch", "--quiet", "work");
	const clone = seedTree([]);
	git(clone, "clone", "--quiet", "--depth=2", "--no-single-branch", `file://${origin}`, ".");
	linkPackage(clone);
	return { clone, origin };
}

export async function moved(): Promise<string> {
	const root = await baselined();
	git(root, "mv", "src/longer.ts", "src/a-longer.ts");
	commitAll(root, "Move");
	return root;
}
