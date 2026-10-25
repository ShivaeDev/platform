import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it(
	"replaces the real starter's workspace dependencies and source conditions while mapping files for a standalone application",
	[],
	function* ({ pack, starterFile }) {
		const files = yield* pack();
		const manifest = JSON.parse(files["package.json"] ?? "{}");
		expect(files["package.json"]).toMatch(/^\{\n\t"name":/u);
		const versions = JSON.parse(starterFile("published-versions.json"));
		for (const deps of [manifest.dependencies, manifest.devDependencies]) {
			for (const [name, version] of Object.entries(deps)) {
				expect(version).not.toContain("workspace:");
				if (name.startsWith("@shivaedev/")) {
					expect(version).toBe(versions[name]);
				}
			}
		}
		expect(manifest.scripts["check:published"]).toBeUndefined();
		const sourceManifest = JSON.parse(starterFile("package.json"));
		for (const name of ["dev", "migrate"]) {
			expect(manifest.scripts[name]).not.toContain("--conditions=source");
			expect(manifest.scripts[name]).toBe(sourceManifest.scripts[name].replaceAll("--conditions=source ", ""));
		}
		for (const path of ["src/test-support/deployChild.ts"]) {
			expect(files[path]).not.toContain("--conditions=source");
			expect(files[path]).toBe(starterFile(path).replaceAll('"--conditions=source", ', ""));
		}
		for (const path of ["tsconfig.json", "vite.config.ts", "vitest.config.ts", "src/server/dev.ts"]) {
			expect(files[path]).not.toContain('"source"');
			expect(files[path]).toBe(starterFile(path).replaceAll('"source", ', "").replaceAll('["source"]', "[]"));
		}
		expect(files["pnpm-workspace.yaml"]).toBe(starterFile("pnpm-workspace.copy.yaml"));
		expect(files["pnpm-workspace.copy.yaml"]).toBeUndefined();
		expect(files["published-versions.json"]).toBeUndefined();
		expect(files["CLAUDE.md"]).toBeUndefined();
		for (const path of ["AGENTS", "README"]) {
			expect(files[`${path}.md`]).toBe(starterFile(`app-${path.toLowerCase()}.md`));
			expect(files[`app-${path.toLowerCase()}.md`]).toBeUndefined();
		}
	},
);
