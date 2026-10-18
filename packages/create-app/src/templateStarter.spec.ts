import { expect } from "vitest";
import { application } from "#test/application.ts";

application.it(
	"packages the real starter with registry dependencies, standalone configuration and its PostgreSQL tests",
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
		for (const path of ["src/server/dev.ts", "src/test-support/deployChild.ts"]) {
			expect(files[path]).not.toContain("--conditions=source");
			expect(files[path]).toBe(starterFile(path).replaceAll('"--conditions=source", ', ""));
		}
		expect(JSON.parse(files["biome.json"] ?? "{}")).toMatchObject({ root: true });
		expect(files["biome.json"]).toBe(starterFile("biome.json").replace('"root": false', '"root": true'));
		for (const path of ["tsconfig.json", "vite.config.ts", "vitest.config.ts"]) {
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
		for (const path of [
			".railway/railway.ts",
			".env.example",
			"src/setup.ts",
			"src/server/migrate.ts",
			"src/server/migrateDatabase.ts",
			"src/server/setup-database.ts",
			"src/server/noteLifecycle.spec.ts",
			"src/server/appDeploy.spec.ts",
			"src/test-support/application.ts",
			"src/test-support/requests.ts",
			"src/test-support/screens.ts",
			"src/server/committedJobs.spec.ts",
			"src/server/notesMigration.spec.ts",
			"src/server/deployReadiness.spec.ts",
			"src/notes.ts",
		]) {
			expect(files[path]).toBe(starterFile(path));
		}
	},
);
