import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { libraryTiers } from "./libraryTiers.ts";

it.each(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"])(
	"rejects a library that lists platform in %s",
	async (key) => {
		expect(
			await checkRule(libraryTiers, {
				"package.json": JSON.stringify({ name: "workspace" }),
				"packages/sql/package.json": JSON.stringify({ [key]: { "@shivaedev/platform": "workspace:*" }, name: "@shivaedev/sql" }),
			}),
		).toEqual([{ file: "packages/sql/package.json", message: expect.stringContaining("declares each piece it imports"), subject: key }]);
	},
);

it("rejects the workspace root and accepts applications and platform itself", async () => {
	const findings = await checkRule(libraryTiers, {
		"examples/starter/package.json": JSON.stringify({ dependencies: { "@shivaedev/platform": "workspace:*" }, name: "@shivaedev/starter" }),
		"package.json": JSON.stringify({ devDependencies: { "@shivaedev/platform": "workspace:*" }, name: "workspace" }),
		"packages/platform/package.json": JSON.stringify({ dependencies: { "@shivaedev/sql": "workspace:*" }, name: "@shivaedev/platform" }),
	});
	expect(findings.map((finding) => finding.file)).toEqual(["package.json"]);
});
