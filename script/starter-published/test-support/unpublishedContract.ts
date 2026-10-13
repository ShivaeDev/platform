import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { documentedImports, importProbe } from "#starter-published/imports.ts";

export function unpublishedContract() {
	const consumer = mkdtempSync(join(tmpdir(), "published-imports-"));
	const pkg = join(consumer, "node_modules/@shivaedev/effect-contract");
	mkdirSync(pkg, { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ exports: { "./operation.ts": "./operation.d.ts" }, type: "module" }));
	writeFileSync(join(pkg, "operation.d.ts"), "export declare const query: unknown;\n");
	const entries = documentedImports(
		'```ts\nimport { query, stream } from "@shivaedev/effect-contract/operation.ts";\n```\nImport `makeLiveServer` from `@shivaedev/effect-contract/makeLiveServer.ts`.',
		"packages/effect-contract/README.md",
	);
	const path = join(consumer, "imports.ts");
	writeFileSync(path, entries.map(importProbe).join("\n"));
	return { entries, path, remove: () => rmSync(consumer, { force: true, recursive: true }) };
}
