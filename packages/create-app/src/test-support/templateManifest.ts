import { readFileSync } from "node:fs";

export function templateManifest(dependencies: Readonly<Record<string, string>>) {
	const source = JSON.parse(readFileSync(new URL("../../../../examples/starter/package.json", import.meta.url), "utf8"));
	return JSON.stringify({ ...source, dependencies, devDependencies: {} });
}
