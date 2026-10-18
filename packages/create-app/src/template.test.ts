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

it("uses exact registry versions and refuses missing or floating workspace replacements", () => {
	expect(registryDependencies({ "@shivaedev/platform": "workspace:*", effect: "catalog:" }, { "@shivaedev/platform": "0.6.1" })).toEqual({
		"@shivaedev/platform": "0.6.1",
		effect: "catalog:",
	});
	for (const versions of [{}, { "@shivaedev/platform": "latest" }, { "@shivaedev/platform": "^0.6.1" }]) {
		expect(() => registryDependencies({ "@shivaedev/platform": "workspace:*" }, versions)).toThrow("name an exact published version");
	}
});

it("replaces workspace dependencies and source conditions while mapping app-only files", async () => {
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
	expect(manifest.scripts.dev).not.toContain("--conditions=source");
	expect(files["src/server/dev.ts"]).not.toContain("--conditions=source");
	expect(files["src/test-support/deployChild.ts"]).not.toContain("--conditions=source");
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
});

it("omits local output and secrets and picks up template changes on each pack", async () => {
	const source = templateSource({ localArtifacts: true });
	for (const value of ["first", "changed"]) {
		source.changeApp(value);
		const files = await source.pack();
		expect(files).toEqual({ ".env.example": "example", "app.ts": value });
	}
});
