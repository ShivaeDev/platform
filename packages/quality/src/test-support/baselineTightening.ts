import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { baselined } from "./baselineRepository.ts";

export function baseline(root: string): string {
	return readFileSync(join(root, "quality-baseline.jsonl"), "utf8");
}

export async function shrunkTwice(): Promise<string> {
	const root = await baselined();
	writeFileSync(join(root, "src/long.ts"), "String(1);\n");
	writeFileSync(join(root, "src/longer.ts"), "String(1);\nString(2);\nString(3);\nString(4);\nString(5);\n");
	return root;
}
