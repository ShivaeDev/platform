import { expect, it } from "vitest";
import { checkRule } from "#quality/test-support/checkRule.ts";
import { codecovComponents } from "./codecovComponents.ts";

const manifests = {
	"examples/app/package.json": '{"name":"app"}',
	"package.json": '{"name":"root"}',
	"packages/a/package.json": '{"name":"@shivaedev/a"}',
};
const block = [
	"component_management:",
	"  individual_components:",
	"    - component_id: app",
	'      name: "app"',
	"      paths:",
	'        - "examples/app/src/**"',
	"    - component_id: a",
	'      name: "@shivaedev/a"',
	"      paths:",
	'        - "packages/a/src/**"',
].join("\n");

it("requires exactly one component for each named workspace package, excluding the root", async () => {
	expect(await checkRule(codecovComponents, { ...manifests, "codecov.yml": "coverage:\n  status: off\n" })).toEqual([
		{ file: "codecov.yml", message: expect.stringContaining("Run `pnpm codecov:components`") },
	]);
	expect(await checkRule(codecovComponents, { ...manifests, "codecov.yml": `${block}\n\ncoverage:\n  status: off\n` })).toEqual([]);
});

it("rejects stale, renamed or missing components", async () => {
	const finding = [{ file: "codecov.yml", message: expect.stringContaining("component_management") }];
	expect(await checkRule(codecovComponents, { ...manifests, "codecov.yml": block.replace("@shivaedev/a", "old") })).toEqual(finding);
	expect(await checkRule(codecovComponents, { ...manifests, "codecov.yml": block, "packages/new/package.json": '{"name":"new"}' })).toEqual(finding);
	expect(await checkRule(codecovComponents, manifests)).toEqual(finding);
});
