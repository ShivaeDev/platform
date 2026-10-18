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
		expect(manifest.scripts.lint).toBe("quality lint");
		expect(manifest.scripts.setup).toBe("pnpm install && node src/setup.ts");
		expect(manifest.devDependencies.railway).toBe("catalog:");
		expect(files["pnpm-workspace.yaml"]).toContain("railway: 3.13.1");
		for (const path of ["railway.json", "railway.worker.json", "railway.toml", "railway.worker.toml"]) {
			expect(files[path]).toBeUndefined();
		}
		for (const path of [".railway/railway.ts", ".railway/railway.test.ts"]) {
			expect(files[path]).toBeDefined();
			expect(files[path]).toBe(starterFile(path));
		}
		expect(JSON.parse(files["tsconfig.json"] ?? "{}").include).toContain(".railway");
		expect(manifest.scripts.format).toBe("quality fix");
		expect(manifest.scripts["db:setup"]).toBe("node --env-file-if-exists=.env.local src/server/setup-database.ts");
		expect(files["script/setup-database.ts"]).toBeUndefined();
		expect(manifest.scripts.dev).toBe("pnpm db:setup && pnpm migrate && node --env-file-if-exists=.env.local src/server/dev.ts");
		expect(manifest.scripts.migrate).toBe("node --env-file-if-exists=.env.local src/server/migrate.ts");
		expect(manifest.scripts.test).toBe("node --env-file-if-exists=.env.local node_modules/vitest/vitest.mjs run");
		expect(manifest.dependencies["@shivaedev/local-postgres"]).toBe(versions["@shivaedev/local-postgres"]);
		expect(manifest.devDependencies["@shivaedev/quality"]).toBe(versions["@shivaedev/quality"]);
		expect(manifest.devDependencies["@shivaedev/test-story"]).toBe(versions["@shivaedev/test-story"]);
		expect(files["quality.config.ts"]).toBeUndefined();
		expect(files["quality/baseline.jsonl"]).toBeUndefined();
		expect(manifest.scripts.dev).not.toContain("--conditions=source");
		expect(files["src/server/dev.ts"]).not.toContain("--conditions=source");
		expect(files["src/test-support/deployChild.ts"]).not.toContain("--conditions=source");
		expect(files["src/server/dev.ts"]).toContain('"--watch"');
		expect(JSON.parse(files["biome.json"] ?? "{}")).toMatchObject({ root: true });
		expect(files["biome.json"]).toBe(starterFile("biome.json").replace('"root": false', '"root": true'));
		for (const path of ["tsconfig.json", "vite.config.ts", "vitest.config.ts"]) {
			expect(files[path]).not.toContain('"source"');
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
