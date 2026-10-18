import { Buffer } from "node:buffer";
import { Effect } from "effect";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { templateManifest } from "#test/templateManifest.ts";
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

application.it("copies the starter CI workflow with every Action pinned to a commit", [], function* ({ pack, starterFile }) {
	const files = yield* pack();
	const workflow = files[".github/workflows/ci.yml"] ?? "";
	expect(workflow).toBe(starterFile(".github/workflows/ci.yml"));
	for (const [, action] of workflow.matchAll(/uses: (?<action>[^\s]+)/gu)) {
		expect(action).toMatch(/@[a-f0-9]{40}$/u);
	}
});

application.it(
	"preserves binary bytes in the packed template",
	[customTemplate({ "image.png": Buffer.from([0, 0xff, 0x80, 0x41]) })],
	function* ({ pack, readPacked }) {
		yield* pack();
		expect(readPacked("image.png")).toEqual(Buffer.from([0, 0xff, 0x80, 0x41]));
	},
);

application.it(
	"replaces workspace dependencies with exact published versions while preserving registry dependencies",
	[
		customTemplate({
			"package.json": templateManifest({ "@shivaedev/platform": "workspace:*", effect: "catalog:" }),
			"published-versions.json": JSON.stringify({ "@shivaedev/platform": "0.6.1" }),
		}),
	],
	function* ({ pack }) {
		const files = yield* pack();
		expect(JSON.parse(files["package.json"] ?? "{}").dependencies).toEqual({ "@shivaedev/platform": "0.6.1", effect: "catalog:" });
	},
);

for (const versions of [{}, { "@shivaedev/platform": "latest" }, { "@shivaedev/platform": "^0.6.1" }]) {
	application.it(
		`rejects a template without an exact workspace replacement: ${JSON.stringify(versions)}`,
		[
			customTemplate({
				"package.json": templateManifest({ "@shivaedev/platform": "workspace:*" }),
				"published-versions.json": JSON.stringify(versions),
			}),
		],
		function* ({ pack }) {
			const failure = yield* Effect.flip(pack());
			expect(failure.message).toContain("@shivaedev/platform: name an exact published version");
		},
	);
}
