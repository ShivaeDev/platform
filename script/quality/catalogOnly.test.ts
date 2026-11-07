import { expect } from "vitest";
import { catalogOnly } from "#quality/catalogOnly.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
	ruleKit.it(
		`rejects external dependencies outside the catalog in ${key}`,
		[
			repositoryHas({
				content: JSON.stringify({ [key]: { effect: "^4.0.4" } }),
				path: "package.json",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(catalogOnly);

			expect(findings).toEqual([
				{
					file: "package.json",
					message: expect.stringContaining("bypasses the catalog"),
				},
			]);
		},
	);
	ruleKit.it(
		`accepts default and named catalog references in ${key}`,
		[
			repositoryHas({
				content: JSON.stringify({
					[key]: { effect: "catalog:", other: "catalog:stable" },
				}),
				path: "package.json",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(catalogOnly);

			expect(findings).toEqual([]);
		},
	);
}

ruleKit.it(
	"requires workspace:* for workspace dependencies in root and member manifests",
	[
		repositoryHas(
			{
				content: JSON.stringify({
					dependencies: { "@shivaedev/a": "1.0.0" },
					name: "app",
				}),
				path: "examples/app/package.json",
			},
			{
				content: JSON.stringify({
					dependencies: { "@shivaedev/a": "catalog:" },
				}),
				path: "package.json",
			},
			{
				content: JSON.stringify({ name: "@shivaedev/a" }),
				path: "packages/a/package.json",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(catalogOnly);

		expect(findings.map((finding) => finding.file)).toEqual(["package.json", "examples/app/package.json"]);
	},
);

ruleKit.it(
	"accepts workspace:* in root and member manifests",
	[
		repositoryHas(
			{
				content: JSON.stringify({
					dependencies: { "@shivaedev/a": "workspace:*" },
					name: "app",
				}),
				path: "examples/app/package.json",
			},
			{
				content: JSON.stringify({
					dependencies: { "@shivaedev/a": "workspace:*" },
				}),
				path: "package.json",
			},
			{
				content: JSON.stringify({ name: "@shivaedev/a" }),
				path: "packages/a/package.json",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(catalogOnly);

		expect(findings).toEqual([]);
	},
);
