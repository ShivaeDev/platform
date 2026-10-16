import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { removeTemplates, templateSource } from "#test/templateSource.ts";
import { registryDependencies } from "./template.ts";

afterEach(removeTemplates);

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
	expect(manifest.scripts.format).toBe("quality fix");
	expect(manifest.scripts["db:setup"]).toBe("node --env-file-if-exists=.env.local src/server/setup-database.ts");
	expect(files["script/setup-database.ts"]).toBeUndefined();
	expect(manifest.scripts.dev).toBe("pnpm db:setup && node --env-file-if-exists=.env.local src/server/dev.ts");
	expect(manifest.scripts.test).toBe("node --env-file-if-exists=.env.local node_modules/vitest/vitest.mjs run");
	expect(manifest.dependencies["@shivaedev/local-postgres"]).toBe(versions["@shivaedev/local-postgres"]);
	expect(manifest.devDependencies["@shivaedev/quality"]).toBe(versions["@shivaedev/quality"]);
	expect(files["quality.config.ts"]).toBeUndefined();
	expect(files["quality/baseline.jsonl"]).toBeUndefined();
	expect(manifest.scripts.dev).not.toContain("--conditions=source");
	expect(files["src/server/dev.ts"]).not.toContain("--conditions=source");
	expect(files["src/server/dev.ts"]).toContain('"--watch"');
	expect(JSON.parse(files["biome.json"] ?? "{}")).toMatchObject({ root: true });
	expect(files["biome.json"]).toBe(readFileSync(join(starter, "biome.json"), "utf8").replace('"root": false', '"root": true'));
	for (const path of ["tsconfig.json", "vite.config.ts", "vitest.config.ts"]) {
		expect(files[path]).not.toContain('"source"');
	}
	expect(files[".env.example"]).toContain("/__APP_DATABASE___dev\n");
	expect(files["pnpm-workspace.yaml"]).toBe(readFileSync(join(starter, "pnpm-workspace.copy.yaml"), "utf8"));
	expect(files["pnpm-workspace.copy.yaml"]).toBeUndefined();
	for (const path of [
		"src/server/setup-database.ts",
		"src/server/starterHost.test.ts",
		"src/server/committedJobs.spec.ts",
		"src/server/notesMigration.spec.ts",
		"src/notes.ts",
	]) {
		expect(files[path]).toBe(readFileSync(join(starter, path), "utf8"));
	}
});

it("packages app guidance and a README without maintainer documentation or version internals", async () => {
	const files = await templateSource({ realStarter: true }).pack();
	for (const path of ["AGENTS.md", "README.md"]) {
		expect(files[path]).toContain("# __APP_NAME__");
		expect(files[path]).not.toMatch(/starter|create-app|check:published|published-versions|--registry/iu);
	}
	expect(files["CLAUDE.md"]).toBeUndefined();
	expect(files["published-versions.json"]).toBeUndefined();
});

it("omits local output and secrets and picks up template changes on each pack", async () => {
	const source = templateSource({ localArtifacts: true });
	for (const value of ["first", "changed"]) {
		source.changeApp(value);
		const files = await source.pack();
		expect(Object.keys(files)).toHaveLength(4);
		expect(Object.keys(files)).toEqual(expect.arrayContaining([".env.example", "AGENTS.md", "README.md", "app.ts"]));
		expect(files["app.ts"]).toBe(value);
		expect(files[".env.example"]).toBe("example");
	}
});
