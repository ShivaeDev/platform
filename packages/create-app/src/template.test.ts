import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { prepareFile, registryDependencies } from "#template.ts";
import { application } from "#test/application.ts";
import { customTemplate } from "#test/traits.ts";

application.it(
	"keeps nested template-internal names and omits root maintenance files",
	[
		customTemplate({
			"AGENTS.md": "template guidance",
			"CLAUDE.md": "template alias",
			"docs/AGENTS.md": "nested guidance",
			"docs/CLAUDE.md": "nested alias",
			"docs/published-versions.json": "nested versions",
			"docs/README.md": "nested readme",
			"README.md": "template readme",
		}),
	],
	function* ({ pack }) {
		expect(yield* pack()).toEqual({
			"docs/AGENTS.md": "nested guidance",
			"docs/CLAUDE.md": "nested alias",
			"docs/published-versions.json": "nested versions",
			"docs/README.md": "nested readme",
		});
	},
);

it("preserves binary files when preparing the template", () => {
	const content = Buffer.from([0, 0xff, 0x80, 0x41]);
	expect(prepareFile("image.png", content, {})).toEqual(content);
});

application.it("exempts only framework packages from pnpm's default release-age wait in a generated app", [], function* ({ pack }) {
	const files = yield* pack();
	const workspace = files["pnpm-workspace.yaml"] ?? "";
	expect(workspace).toMatch(/^minimumReleaseAgeExclude: \["@shivaedev\/\*"\]$/mu);
	expect(workspace).not.toMatch(/^minimumReleaseAge:/mu);
});

application.it("packages pinned GitHub Actions running the generated app's own CI script against PostgreSQL", [], function* ({ pack }) {
	const files = yield* pack();
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

application.it(
	"omits local output and secrets and picks up template changes on each pack",
	[customTemplate({}, true)],
	function* ({ changeTemplate, pack }) {
		for (const value of ["first", "changed"]) {
			changeTemplate(value);
			const files = yield* pack();
			expect(files).toEqual({ ".env.example": "example", "app.ts": value });
		}
	},
);
