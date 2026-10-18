import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { prepareFile, registryDependencies } from "#template.ts";
import { removeTemplates, templateSource } from "#test/templateSource.ts";

afterEach(removeTemplates);

it("keeps nested template-internal names and omits root maintenance files", async () => {
	const source = templateSource();
	source.files({
		"AGENTS.md": "template guidance",
		"CLAUDE.md": "template alias",
		"docs/AGENTS.md": "nested guidance",
		"docs/CLAUDE.md": "nested alias",
		"docs/published-versions.json": "nested versions",
		"docs/README.md": "nested readme",
		"README.md": "template readme",
	});
	expect(await source.pack()).toEqual({
		"docs/AGENTS.md": "nested guidance",
		"docs/CLAUDE.md": "nested alias",
		"docs/published-versions.json": "nested versions",
		"docs/README.md": "nested readme",
	});
});

it("preserves binary files when preparing the template", () => {
	const content = Buffer.from([0, 0xff, 0x80, 0x41]);
	expect(prepareFile("image.png", content, {})).toEqual(content);
});

it("exempts only framework packages from pnpm's default release-age wait in a generated app", async () => {
	const files = await templateSource({ realStarter: true }).pack();
	const workspace = files["pnpm-workspace.yaml"] ?? "";
	expect(workspace).toMatch(/^minimumReleaseAgeExclude: \["@shivaedev\/\*"\]$/mu);
	expect(workspace).not.toMatch(/^minimumReleaseAge:/mu);
});

it("packages pinned GitHub Actions running the generated app's own CI script against PostgreSQL", async () => {
	const files = await templateSource({ realStarter: true }).pack();
	const manifest = JSON.parse(files["package.json"] ?? "{}");
	expect(manifest.scripts.ci).toBe("pnpm lint && pnpm typecheck && pnpm build && pnpm test");
	expect(manifest.scripts.ready).toBe("pnpm run ci");
	const workflow = files[".github/workflows/ci.yml"] ?? "";
	expect(workflow).toContain("run: pnpm run ci");
	expect(workflow).toContain("run: pnpm install --frozen-lockfile");
	expect(workflow).toContain("image: postgres:18");
	expect(workflow).toContain("TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/app_test");
	const actions = Array.from(workflow.matchAll(/uses: (?<action>[^\s]+)/gu), ([, action]) => action);
	expect(actions).toHaveLength(3);
	for (const action of actions) {
		expect(action).toMatch(/@[a-f0-9]{40}$/u);
	}
});

it("uses exact registry versions and refuses missing or floating workspace replacements", () => {
	expect(registryDependencies({ "@shivaedev/platform": "workspace:*", effect: "catalog:" }, { "@shivaedev/platform": "0.6.1" })).toEqual({
		"@shivaedev/platform": "0.6.1",
		effect: "catalog:",
	});
	for (const versions of [{}, { "@shivaedev/platform": "latest" }, { "@shivaedev/platform": "^0.6.1" }]) {
		expect(() => registryDependencies({ "@shivaedev/platform": "workspace:*" }, versions)).toThrow("name an exact published version");
	}
});

it("packages the real starter with registry dependencies, standalone configuration and its PostgreSQL tests", async () => {
	const source = templateSource({ realStarter: true });
	const { starter } = source;
	const files = await source.pack();
	const manifest = JSON.parse(files["package.json"] ?? "{}");
	expect(files["package.json"]).toMatch(/^\{\n\t"name":/u);
	const versions = JSON.parse(readFileSync(join(starter, "published-versions.json"), "utf8"));
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
		expect(files[path]).toBe(readFileSync(join(starter, path), "utf8"));
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
	expect(files["biome.json"]).toBe(readFileSync(join(starter, "biome.json"), "utf8").replace('"root": false', '"root": true'));
	for (const path of ["tsconfig.json", "vite.config.ts", "vitest.config.ts"]) {
		expect(files[path]).not.toContain('"source"');
	}
	expect(files["pnpm-workspace.yaml"]).toBe(readFileSync(join(starter, "pnpm-workspace.copy.yaml"), "utf8"));
	expect(files["pnpm-workspace.copy.yaml"]).toBeUndefined();
	expect(files["published-versions.json"]).toBeUndefined();
	expect(files["CLAUDE.md"]).toBeUndefined();
	for (const path of ["AGENTS", "README"]) {
		expect(files[`${path}.md`]).toBe(readFileSync(join(starter, `app-${path.toLowerCase()}.md`), "utf8"));
		expect(files[`app-${path.toLowerCase()}.md`]).toBeUndefined();
	}
	for (const path of [
		".env.example",
		"src/setup.ts",
		"src/server/migrate.ts",
		"src/server/migrateDatabase.ts",
		"src/server/setup-database.ts",
		"src/server/notesHost.test.ts",
		"src/server/appDeploy.spec.ts",
		"src/test-support/application.ts",
		"src/test-support/requests.ts",
		"src/test-support/screens.ts",
		"src/server/committedJobs.spec.ts",
		"src/server/notesMigration.spec.ts",
		"src/server/deployReadiness.spec.ts",
		"src/notes.ts",
	]) {
		expect(files[path]).toBe(readFileSync(join(starter, path), "utf8"));
	}
});

it("omits local output and secrets and picks up template changes on each pack", async () => {
	const source = templateSource({ localArtifacts: true });
	for (const value of ["first", "changed"]) {
		source.changeApp(value);
		const files = await source.pack();
		expect(files).toEqual({ ".env.example": "example", "app.ts": value });
	}
});
