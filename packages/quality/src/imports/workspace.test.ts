import { describe, expect, it } from "vitest";
import { workspacePackages } from "#imports/workspace.ts";
import { inputsOf } from "#test/inputs.ts";

describe("workspace package membership", () => {
	it("honors excluded workspace folders and ignores malformed or unnamed member manifests", async () => {
		const found = await workspacePackages(
			inputsOf({
				files: [
					"package.json",
					"packages/web/package.json",
					"packages/example/package.json",
					"packages/broken/package.json",
					"packages/unnamed/package.json",
				],
				texts: {
					"package.json": "{",
					"packages/broken/package.json": "{",
					"packages/example/package.json": '{"name": "@demo/example"}',
					"packages/unnamed/package.json": '{"private": true}',
					"packages/web/package.json": '{"name": "@demo/web"}',
					"pnpm-workspace.yaml": "packages:\n  - packages/*\n  - '!packages/example'\n",
				},
			}),
		);
		expect(found).toEqual([{ directory: "packages/web", name: "@demo/web" }]);
	});
});
