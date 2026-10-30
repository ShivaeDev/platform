import { Buffer } from "node:buffer";
import { expect } from "vitest";
import { application } from "#test/application.ts";
import { templateManifest } from "#test/templateManifest.ts";
import { customTemplate, localArtifacts } from "#test/traits.ts";

const IMAGE = Buffer.from([0, 0xff, 0x80, 0x41]);

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
	"packing leaves out local output, the lockfile and every .env file except .env.example",
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
			expect(yield* pack()).toBe("refused: CreateAppError: @shivaedev/platform: name an exact published version in published-versions.json");
		},
	);
}
