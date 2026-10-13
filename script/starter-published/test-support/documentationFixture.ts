import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function documentationFixture(specifier: string, name = "query") {
	const root = mkdtempSync(join(tmpdir(), "published-guide-"));
	for (const path of ["docs/framework", "examples/starter", "packages/effect-contract", "node_modules/@shivaedev/effect-contract"]) {
		mkdirSync(join(root, path), { recursive: true });
	}
	for (const path of ["docs/framework/quickstart.md", "examples/starter/README.md", "packages/effect-contract/README.md"]) {
		writeFileSync(join(root, path), "");
	}
	writeFileSync(join(root, "docs/framework/add-a-feature.md"), `\`\`\`ts\nimport { ${name} } from "${specifier}";\n\`\`\`\n`);
	const pkg = join(root, "node_modules/@shivaedev/effect-contract");
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ exports: { "./operation.ts": "./operation.d.ts" }, type: "module" }));
	writeFileSync(join(pkg, "operation.d.ts"), "export declare const query: unknown;\n");
	return { remove: () => rmSync(root, { force: true, recursive: true }), root };
}
