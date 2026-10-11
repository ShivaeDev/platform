import { afterEach, describe, expect, it } from "vitest";
import { workspacePackages } from "#imports/workspace.ts";
import { scanned } from "#test/imports.ts";
import { inputsOf } from "#test/inputs.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("workspace package membership", () => {
	it("honors excluded workspace folders and ignores malformed or unnamed member manifests", async () => {
		const { files, readText } = inputsOf({
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
		});
		const found = await workspacePackages({ files, readText });
		expect(found).toEqual([{ directory: "packages/web", name: "@demo/web" }]);
	});

	it("discovers member manifests independently of the source inventory while respecting repository ignores and workspace exclusions", async () => {
		const root = seedTree([
			{ content: "packages:\n  - packages/*\n  - '!packages/example'\n", path: "pnpm-workspace.yaml" },
			{ content: "packages/ignored/\n", path: ".gitignore" },
			...[
				["web", '{"name":"@demo/web"}'],
				["example", '{"name":"@demo/example"}'],
				["ignored", '{"name":"@demo/ignored"}'],
				["broken", "{"],
				["unnamed", '{"private":true}'],
			].map(([directory, content = ""]) => ({ content, path: `packages/${directory}/package.json` })),
			{ content: '{"name":"installed"}', path: "node_modules/packages/installed/package.json" },
		]);
		expect(await workspacePackages({ ...(await scanned(root)), files: ["packages/web/src/index.ts"] })).toEqual([
			{ directory: "packages/web", name: "@demo/web" },
		]);
	});
});
