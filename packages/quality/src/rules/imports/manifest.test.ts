import { afterEach, describe, expect, it } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { findingsIn } from "#test/imports.ts";
import { manifestTree } from "#test/manifestTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

const shipped = { content: 'import "plain-kit";', path: "modules/app/src/app.ts" };

const developmentPaths = [
	"modules/app/src/app.test.ts",
	"modules/app/src/app.dom.spec.tsx",
	"modules/app/src/app.typecheck.test.ts",
	"modules/app/src/test-support/fixture.ts",
	"modules/app/script/check.ts",
	"modules/app/scripts/check.ts",
	"modules/app/tooling/check.ts",
	"modules/app/vitest.config.ts",
	"modules/app/config.mjs",
];

describe("imports/manifest", () => {
	it.each(["npm", "pnpm"] as const)("finds undeclared scoped and unscoped workspace imports without fences in a %s workspace", async (workspace) => {
		const root = manifestTree([shipped, { content: 'import "@acme/app";', path: "modules/kit/src/app.ts" }], { workspace });
		const findings = await findingsIn(importsManifest, undefined, root);
		expect(findings.map((finding) => [finding.file, finding.line, finding.subject])).toEqual([
			[shipped.path, 1, "plain-kit"],
			["modules/kit/src/app.ts", 1, "@acme/app"],
		]);
		expect(findings[0]?.message).toContain("Add it to dependencies, peerDependencies or optionalDependencies, or remove the import.");
	});

	it("uses literal workspace scopes, including @types, and ignores import queries when naming a package", async () => {
		const root = manifestTree([
			{ content: '{"name":"@types/shapes"}', path: "modules/shapes/package.json" },
			{ content: 'import type {} from "@types/shapes/subpath";\nimport "plain-kit?raw";', path: shipped.path },
		]);
		expect((await findingsIn(importsManifest, undefined, root)).map((finding) => finding.subject)).toEqual(["@types/shapes", "plain-kit"]);
	});

	it.each(["dependencies", "peerDependencies", "optionalDependencies"])("allows %s in shipped code", async (declaration) => {
		expect(await findingsIn(importsManifest, undefined, manifestTree([shipped], { declaration }))).toEqual([]);
	});

	it("allows devDependencies only in tests, test support and tooling, including at the workspace root", async () => {
		const root = manifestTree(
			[
				shipped,
				{ content: 'import type { kit } from "plain-kit";', path: "modules/app/src/types.ts" },
				{ content: 'import "plain-kit";', path: "modules/app/src/scripts/shipped.ts" },
				{ content: 'import "plain-kit";', path: "modules/app/src/runtime.config.ts" },
				...developmentPaths.map((path) => ({ content: shipped.content, path })),
				{ content: '{"name":"root","devDependencies":{"plain-kit":"workspace:*"}}', path: "package.json" },
				{ content: shipped.content, path: "script/check.ts" },
				{ content: shipped.content, path: "src/main.ts" },
			],
			{ declaration: "devDependencies" },
		);
		expect((await findingsIn(importsManifest, undefined, root)).map((finding) => finding.file)).toEqual([
			shipped.path,
			"modules/app/src/runtime.config.ts",
			"modules/app/src/scripts/shipped.ts",
			"modules/app/src/types.ts",
			"src/main.ts",
		]);
	});

	it("still requires a declaration in development code", async () => {
		const root = manifestTree(developmentPaths.map((path) => ({ content: shipped.content, path })));
		expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(developmentPaths.length);
	});

	it("sees subpaths, resolved aliases, relative imports and missing paths, dynamic imports, re-exports, require and type queries", async () => {
		const content = [
			'import "plain-kit/index.ts";',
			'import "#kit";',
			'import "../../kit/src/index.ts";',
			'import "../../kit/generated/missing.ts";',
			'export { kit } from "plain-kit";',
			'const kit = import("plain-kit");',
			'const required = require("plain-kit");',
			'type Kit = typeof import("plain-kit");',
			'import "other-external";',
			'import "@acme/app";',
		].join("\n");
		const root = manifestTree([{ content, path: shipped.path }], { linked: true });
		expect((await findingsIn(importsManifest, undefined, root)).map((finding) => finding.line).toSorted()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it("keeps a nested non-workspace manifest inside its workspace owner", async () => {
		const root = manifestTree([
			{ content: '{"dependencies":{"plain-kit":"workspace:*"}}', path: "modules/app/src/nested/package.json" },
			{ ...shipped, path: "modules/app/src/nested/app.ts" },
		]);
		expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(1);
	});

	it("fails closed on unreadable dependency policy", async () => {
		const root = manifestTree([shipped, { content: '{"name":"@acme/app","dependencies":[]}', path: "modules/app/package.json" }]);
		await expect(findingsIn(importsManifest, undefined, root)).rejects.toThrow("cannot read dependency policy at modules/app/package.json");
	});
});
