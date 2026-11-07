import { expect } from "vitest";
import { libraryTiers } from "#quality/libraryTiers.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
	ruleKit.it(
		`rejects a library that lists platform in ${key}`,
		[
			repositoryHas(
				{
					content: JSON.stringify({ name: "workspace" }),
					path: "package.json",
				},
				{
					content: JSON.stringify({
						[key]: { "@shivaedev/platform": "workspace:*" },
						name: "@shivaedev/sql",
					}),
					path: "packages/sql/package.json",
				},
			),
		],
		function* ({ check }) {
			const findings = yield* check(libraryTiers);

			expect(findings).toEqual([
				{
					file: "packages/sql/package.json",
					message: expect.stringContaining("declares each piece it imports"),
					subject: key,
				},
			]);
		},
	);
}

ruleKit.it(
	"rejects the workspace root and accepts applications and platform itself",
	[
		repositoryHas(
			{
				content: JSON.stringify({
					dependencies: { "@shivaedev/platform": "workspace:*" },
					name: "@shivaedev/starter",
				}),
				path: "examples/starter/package.json",
			},
			{
				content: JSON.stringify({
					devDependencies: { "@shivaedev/platform": "workspace:*" },
					name: "workspace",
				}),
				path: "package.json",
			},
			{
				content: JSON.stringify({
					dependencies: { "@shivaedev/sql": "workspace:*" },
					name: "@shivaedev/platform",
				}),
				path: "packages/platform/package.json",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(libraryTiers);

		expect(findings.map((finding) => finding.file)).toEqual(["package.json"]);
	},
);
