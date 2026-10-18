import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { catalogOnly } from "./catalogOnly.ts";

it.each(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"])("requires catalog references in %s", async (key) => {
	expect(await checkRule(catalogOnly, { "package.json": JSON.stringify({ [key]: { effect: "^4.0.4" } }) })).toEqual([
		{ file: "package.json", message: expect.stringContaining("bypasses the catalog") },
	]);
	expect(await checkRule(catalogOnly, { "package.json": JSON.stringify({ [key]: { effect: "catalog:", other: "catalog:stable" } }) })).toEqual([]);
});

it("requires workspace:* for workspace dependencies in root and member manifests", async () => {
	const texts = {
		"examples/app/package.json": JSON.stringify({ dependencies: { "@shivaedev/a": "1.0.0" }, name: "app" }),
		"package.json": JSON.stringify({ dependencies: { "@shivaedev/a": "catalog:" } }),
		"packages/a/package.json": JSON.stringify({ name: "@shivaedev/a" }),
	};
	expect((await checkRule(catalogOnly, texts)).map((finding) => finding.file)).toEqual(["package.json", "examples/app/package.json"]);
	expect(
		await checkRule(catalogOnly, {
			...texts,
			"examples/app/package.json": JSON.stringify({ dependencies: { "@shivaedev/a": "workspace:*" }, name: "app" }),
			"package.json": JSON.stringify({ dependencies: { "@shivaedev/a": "workspace:*" } }),
		}),
	).toEqual([]);
});
