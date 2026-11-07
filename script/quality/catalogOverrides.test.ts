import { expect } from "vitest";
import { catalogOverrides } from "#quality/catalogOverrides.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

for (const key of ["overrides", "pnpm", "resolutions"]) {
	ruleKit.it(
		`rejects the ignored manifest field ${key}`,
		[
			repositoryHas(
				{ content: "{}", path: "package.json" },
				{ content: "catalog:\n  effect: 4.0.4\n", path: "pnpm-workspace.yaml" },
				{
					content: JSON.stringify({ [key]: {} }),
					path: "packages/a/package.json",
				},
			),
		],
		function* ({ check }) {
			const findings = yield* check(catalogOverrides);

			expect(findings).toEqual([
				{
					file: "packages/a/package.json",
					message: expect.stringContaining(`"${key}" is not read by pnpm`),
				},
			]);
		},
	);
}

ruleKit.it(
	"accepts manifests without ignored override fields",
	[repositoryHas({ content: "{}", path: "package.json" }, { content: "catalog:\n  effect: 4.0.4\n", path: "pnpm-workspace.yaml" })],
	function* ({ check }) {
		const findings = yield* check(catalogOverrides);

		expect(findings).toEqual([]);
	},
);

ruleKit.it(
	"rejects workspace overrides outside the catalog",
	[repositoryHas({ content: "{}", path: "package.json" }, { content: "overrides:\n  effect: 4.0.4\n", path: "pnpm-workspace.yaml" })],
	function* ({ check }) {
		const findings = yield* check(catalogOverrides);

		expect(findings).toEqual([
			{
				file: "pnpm-workspace.yaml",
				line: 2,
				message: expect.stringContaining("outside the catalog"),
			},
		]);
	},
);

ruleKit.it(
	"accepts workspace overrides referencing default and named catalogs",
	[
		repositoryHas(
			{ content: "{}", path: "package.json" },
			{
				content: "overrides:\n  effect: catalog:\n  other: 'catalog:stable'\n",
				path: "pnpm-workspace.yaml",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(catalogOverrides);

		expect(findings).toEqual([]);
	},
);
