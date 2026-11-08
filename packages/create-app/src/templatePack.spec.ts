import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { templateManifest } from "#test/templateManifest.ts";
import { customTemplate, localArtifacts } from "#test/traits.ts";

const IMAGE = new Uint8Array([0, 0xff, 0x80, 0x41]);

application.it(
	"packing leaves out AGENTS.md, CLAUDE.md, README.md and published-versions.json at the template root but keeps them in docs/",
	[
		customTemplate(
			{
				"AGENTS.md": "template guidance",
				"CLAUDE.md": "template alias",
				"docs/AGENTS.md": "nested guidance",
				"docs/CLAUDE.md": "nested alias",
				"docs/published-versions.json": "nested versions",
				"docs/README.md": "nested readme",
				"README.md": "template readme",
			},
			"the template holds AGENTS.md, CLAUDE.md, README.md and published-versions.json at its root and in docs/",
		),
	],
	function* ({ pack, packedFiles }) {
		yield* pack();

		expect(yield* packedFiles()).toEqual({
			"docs/AGENTS.md": "nested guidance",
			"docs/CLAUDE.md": "nested alias",
			"docs/published-versions.json": "nested versions",
			"docs/README.md": "nested readme",
		});
	},
);

application.it(
	"packing leaves out local output, synced agent directories, the lockfile and every .env file except .env.example",
	[localArtifacts],
	function* ({ pack, packedFiles }) {
		yield* pack();

		expect(yield* packedFiles()).toEqual({ ".env.example": "example", "app.ts": "export const app = true;\n" });
	},
);

application.it(
	"packing keeps a binary file's bytes",
	[customTemplate({ "image.png": IMAGE }, "the template holds image.png with the bytes 00 ff 80 41")],
	function* ({ pack, packedBytes }) {
		yield* pack();

		expect(yield* packedBytes("image.png")).toEqual(IMAGE);
	},
);

application.it(
	"packing replaces a workspace dependency with its published version and keeps a catalog dependency",
	[
		customTemplate(
			{
				"package.json": templateManifest({ "@shivaedev/platform": "workspace:*", effect: "catalog:" }),
				"published-versions.json": JSON.stringify({ "@shivaedev/platform": "0.6.1" }),
			},
			"the template depends on @shivaedev/platform workspace:*, published as 0.6.1, and effect catalog:",
		),
	],
	function* ({ pack, packedManifest }) {
		yield* pack();

		expect((yield* packedManifest()).dependencies).toEqual({ "@shivaedev/platform": "0.6.1", effect: "catalog:" });
	},
);

for (const [described, versions] of [
	["has no entry for it", {}],
	["pins latest", { "@shivaedev/platform": "latest" }],
	["pins the range ^0.6.1", { "@shivaedev/platform": "^0.6.1" }],
] as const) {
	application.it(
		`packing refuses @shivaedev/platform workspace:* when published-versions.json ${described}`,
		[
			customTemplate(
				{
					"package.json": templateManifest({ "@shivaedev/platform": "workspace:*" }),
					"published-versions.json": JSON.stringify(versions),
				},
				`the template depends on @shivaedev/platform workspace:* and published-versions.json ${described}`,
			),
		],
		function* ({ pack }) {
			expect(yield* pack()).toBe(
				"refused: Failed to prepare template file package.json: @shivaedev/platform: name an exact published version in published-versions.json",
			);
		},
	);
}

for (const heading of ["catalogs", '"catalogs"']) {
	application.it(
		`packing a template preserves its ${heading} mapping and adds exact framework pins`,
		[
			customTemplate(
				{
					"package.json": templateManifest({ "@shivaedev/platform": "workspace:*", effect: "catalog:runtime" }),
					"pnpm-workspace.copy.yaml": `packages: []\n${heading}: # runtime dependencies\n  runtime:\n    effect: 4.0.6\n`,
					"published-versions.json": JSON.stringify({ "@shivaedev/platform": "0.6.1" }),
				},
				"the template has an existing runtime catalog and a published platform dependency",
			),
		],
		function* ({ pack, packedFile, packedFrameworkPins, packedManifest }) {
			yield* pack();

			yield* outcomes([
				[
					"dependency references",
					() => packedManifest(),
					{ dependencies: { "@shivaedev/platform": "catalog:framework", effect: "catalog:runtime" } },
				],
				["framework pins", () => packedFrameworkPins(["@shivaedev/platform"]), { "@shivaedev/platform": "0.6.1" }],
				["existing catalog", () => packedFile("pnpm-workspace.yaml"), expect.stringContaining("  runtime:\n    effect: 4.0.6\n")],
			]);
		},
	);
}

application.it(
	"packing refuses a framework range before putting it in a catalog",
	[
		customTemplate(
			{
				"package.json": templateManifest({ "@shivaedev/platform": "workspace:*" }),
				"pnpm-workspace.copy.yaml": "catalog:\n  effect: 4.0.6\n",
				"published-versions.json": JSON.stringify({ "@shivaedev/platform": "^0.6.1" }),
			},
			"the template has a catalog but its published framework version is a range",
		),
	],
	function* ({ pack }) {
		const answer = yield* pack();

		expect(answer).toBe(
			"refused: Failed to prepare template file package.json: @shivaedev/platform: name an exact published version in published-versions.json",
		);
	},
);
