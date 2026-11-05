import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { packageExports } from "./packageExports.ts";

export function writePackageExports(root: string, exports: unknown, path: string): void {
	const target = join(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, packageExports(exports, path).content);
}
