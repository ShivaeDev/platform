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
	expect(manifest.devDependencies["@shivaedev/quality"]).toBe(versions["@shivaedev/quality"]);
	expect(files["quality.config.ts"]).toBeUndefined();
	expect(files["quality/baseline.jsonl"]).toBeUndefined();
	expect(manifest.scripts.dev).not.toContain("--conditions=source");
	expect(JSON.parse(files["biome.json"] ?? "{}")).toMatchObject({ root: true });
	expect(files["biome.json"]).toBe(readFileSync(join(starter, "biome.json"), "utf8").replace('"root": false', '"root": true'));
	for (const path of ["tsconfig.json", "vite.config.ts", "vitest.config.ts"]) {
		expect(files[path]).not.toContain('"source"');
	}
	expect(files["pnpm-workspace.yaml"]).toBe(readFileSync(join(starter, "pnpm-workspace.copy.yaml"), "utf8"));
	expect(files["pnpm-workspace.copy.yaml"]).toBeUndefined();
	for (const path of [".env.example", "src/server/starterHost.test.ts", "src/server/committedJobs.spec.ts", "src/notes.ts"]) {
		expect(files[path]).toBe(readFileSync(join(starter, path), "utf8"));
	}
});

it("omits local output and secrets and picks up template changes on each pack", async () => {
	const source = templateSource({ localArtifacts: true });
	for (const value of ["first", "changed"]) {
		source.changeApp(value);
		const files = await source.pack();
		expect(files).toEqual({ ".env.example": "example", "app.ts": value, "published-versions.json": "{}" });
	}
});
