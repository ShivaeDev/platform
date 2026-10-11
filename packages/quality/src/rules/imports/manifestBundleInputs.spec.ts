import { afterEach, expect, it } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { findingsIn } from "#test/imports.ts";
import { manifestTree } from "#test/manifestTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

const blocked = {
	"./*.ts": "./src/*.ts",
	"./bundle/*": null,
};
const input = { content: 'import "plain-kit";', path: "modules/app/src/bundle/input.ts" };

function manifest(exports: object = blocked, bin?: string) {
	return {
		content: JSON.stringify({ bin, devDependencies: { "plain-kit": "workspace:*" }, exports, name: "@acme/app" }),
		path: "modules/app/package.json",
	};
}

it("allows declared development dependencies in explicitly export-blocked bundle inputs", async () => {
	const root = manifestTree([manifest(), input]);
	expect(await findingsIn(importsManifest, undefined, root)).toEqual([]);
});

it("still rejects undeclared dependencies in export-blocked bundle inputs", async () => {
	const root = manifestTree([input, { content: JSON.stringify({ exports: blocked, name: "@acme/app" }), path: "modules/app/package.json" }]);
	expect((await findingsIn(importsManifest, undefined, root)).map(({ subject }) => subject)).toEqual(["plain-kit"]);
});

it.each([
	'import "./bundle/input.ts";',
	'export * from "./bundle/input.ts";',
	'type Input = typeof import("./bundle/input.ts");',
	'const input = import("./bundle/input.ts");',
])("rejects a development dependency when public code reaches a blocked input through %s", async (content) => {
	const root = manifestTree([manifest(), input, { content, path: "modules/app/src/public.ts" }]);
	expect((await findingsIn(importsManifest, undefined, root)).map(({ file }) => file)).toEqual([input.path]);
});

it("follows blocked helpers and cycles reached by runtime code", async () => {
	const root = manifestTree([
		manifest(),
		{ ...input, content: 'import "plain-kit"; import "./helper.ts";' },
		{ content: 'import "./input.ts";', path: "modules/app/src/bundle/helper.ts" },
		{ content: 'import "./bundle/helper.ts";', path: "modules/app/src/public.ts" },
	]);
	expect((await findingsIn(importsManifest, undefined, root)).map(({ file }) => file)).toEqual([input.path]);
});

it.each(["./dist/bundle/input.js", "./src/bundle/input.ts"])("keeps executable %s in the runtime dependency boundary", async (bin) => {
	const root = manifestTree([manifest(blocked, bin), input]);
	expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(1);
});

it("keeps executable tooling inside the runtime dependency boundary", async () => {
	const root = manifestTree([manifest(blocked, "./tooling/cli.ts"), { ...input, path: "modules/app/tooling/cli.ts" }]);
	expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(1);
});

it.each([
	{ ...blocked, "./bundle/input.ts": "./src/bundle/input.ts" },
	{ ...blocked, "./bundle/input.*": "./src/bundle/input.*" },
])("honors a more specific public export inside a blocked pattern", async (exports) => {
	const root = manifestTree([manifest(exports), input]);
	expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(1);
});

it.each(["./src/bundle/input.ts", "./dist/bundle/input.js", "./dist/bundle/input.d.ts"])(
	"rejects a blocked source also exported through alias %s",
	async (target) => {
		const root = manifestTree([manifest({ ...blocked, "./public.ts": target }), input]);
		expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(1);
	},
);

it.each([
	{ bin: { app: "./dist/bundle/input.mjs" }, path: "modules/app/src/bundle/input.mts" },
	{ bin: { app: "./dist/bundle/input.cjs" }, path: "modules/app/src/bundle/input.cts" },
])("keeps compiled executable $path in the runtime boundary", async ({ bin, path }) => {
	const root = manifestTree([
		{
			content: JSON.stringify({ bin, devDependencies: { "plain-kit": "workspace:*" }, exports: blocked, name: "@acme/app" }),
			path: "modules/app/package.json",
		},
		{ ...input, path },
	]);
	expect(await findingsIn(importsManifest, undefined, root)).toHaveLength(1);
});
