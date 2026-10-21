import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function fixtureWorkspace() {
	const root = mkdtempSync(join(tmpdir(), "platform-discovery-"));
	function declared(zone: string, name: string, scripts: Readonly<Record<string, string>>) {
		const directory = join(root, zone, name);
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, "package.json"), JSON.stringify({ name, scripts }));
	}
	return {
		close: () => rmSync(root, { force: true, recursive: true }),
		configured: (zone: string, name: string) => writeFileSync(join(root, zone, name, "vitest.config.ts"), "export default {};"),
		example: (name: string) => declared("examples", name, { test: "vitest run" }),
		package: (name: string, scripts: Readonly<Record<string, string>>) => declared("packages", name, scripts),
		root,
	};
}
