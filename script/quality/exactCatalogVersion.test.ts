import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { exactCatalogVersion } from "./exactCatalogVersion.ts";

for (const version of ["^4.0.4", "~4.0.4", "latest", "workspace:*", "4.0", "npm:effect@^4.0.4"]) {
	ruleKit.it(
		`rejects the non-exact catalog version ${version}`,
		[
			repositoryHas({
				content: `catalog:\n  effect: '${version}'\n`,
				path: "pnpm-workspace.yaml",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(exactCatalogVersion);

			expect(findings).toEqual([
				{
					file: "pnpm-workspace.yaml",
					line: 2,
					message: expect.stringContaining("is not an exact version"),
				},
			]);
		},
	);
}

ruleKit.it(
	"accepts quoted pins, prereleases, build metadata and npm aliases",
	[
		repositoryHas({
			content: ["catalog:", '  effect: "4.0.4" # exact pin', "  prerelease: 4.0.0-rc.1", "  build: '1.2.3+build.4'", "  alias: npm:other@1.2.3"].join(
				"\n",
			),
			path: "pnpm-workspace.yaml",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(exactCatalogVersion);

		expect(findings).toEqual([]);
	},
);

ruleKit.it(
	"rejects ranges in named catalogs",
	[
		repositoryHas({
			content: "catalogs:\n  stable:\n    effect: ^4.0.4\n",
			path: "pnpm-workspace.yaml",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(exactCatalogVersion);

		expect(findings).toEqual([
			{
				file: "pnpm-workspace.yaml",
				line: 3,
				message: expect.stringContaining("is not an exact version"),
			},
		]);
	},
);

ruleKit.it(
	"accepts named catalog pins and stops checking at the next top-level section",
	[
		repositoryHas({
			content: "catalogs:\n  stable:\n    effect: 4.0.4\npackages:\n  - packages/*\noverrides:\n  effect: catalog:\n",
			path: "pnpm-workspace.yaml",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(exactCatalogVersion);

		expect(findings).toEqual([]);
	},
);
