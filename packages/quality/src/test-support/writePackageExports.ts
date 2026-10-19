import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sortPackageJson from "sort-package-json";

function sourceFirst(_key: string, value: unknown): unknown {
	if (typeof value !== "object" || value === null || !("source" in value)) {
		return value;
	}
	return Object.fromEntries([["source", value.source], ...Object.entries(value).filter(([key]) => key !== "source")]);
}

export function writePackageExports(root: string, exports: unknown, path: string): void {
	const target = join(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, sortPackageJson(`${JSON.stringify({ exports, name: "@acme/library" }, sourceFirst, "\t")}\n`));
}
