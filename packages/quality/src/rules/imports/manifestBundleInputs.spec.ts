import { expect } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { blocked, bundleManifest } from "#test/bundleManifest.ts";
import { importStory, repositoryHas, repositoryHolds } from "#test/importStory.ts";
import { manifestTree } from "#test/manifestTree.ts";

const INPUT = { content: 'import "plain-kit";', path: "modules/app/src/bundle/input.ts" };

const WORKSPACE = repositoryHolds(manifestTree());

const REACHES = [
	["an import", 'import "./bundle/input.ts";'],
	["a re-export", 'export * from "./bundle/input.ts";'],
	["a type query", 'type Input = typeof import("./bundle/input.ts");'],
	["a dynamic import", 'const input = import("./bundle/input.ts");'],
] as const;

const PUBLIC_EXPORTS = [
	["an exact export", { ...blocked, "./bundle/input.ts": "./src/bundle/input.ts" }],
	["a more specific pattern", { ...blocked, "./bundle/input.*": "./src/bundle/input.*" }],
] as const;

importStory.it(
	"imports/manifest accepts a declared development dependency in an export-blocked bundle input",
	[WORKSPACE, repositoryHas(bundleManifest(), INPUT)],
	function* ({ check }) {
		expect(yield* check(importsManifest)).toEqual([]);
	},
);

importStory.it(
	"imports/manifest reports an undeclared dependency in an export-blocked bundle input",
	[WORKSPACE, repositoryHas(INPUT, { content: JSON.stringify({ exports: blocked, name: "@acme/app" }), path: "modules/app/package.json" })],
	function* ({ check, sites }) {
		yield* check(importsManifest);

		expect(yield* sites()).toEqual([`${INPUT.path}:1 plain-kit`]);
	},
);

for (const [form, content] of REACHES) {
	importStory.it(
		`imports/manifest reports a development dependency in a blocked bundle input that public code reaches through ${form}`,
		[WORKSPACE, repositoryHas(bundleManifest(), INPUT, { content, path: "modules/app/src/public.ts" })],
		function* ({ check, sites }) {
			yield* check(importsManifest);

			expect(yield* sites()).toEqual([`${INPUT.path}:1 plain-kit`]);
		},
	);
}

importStory.it(
	"imports/manifest follows blocked helpers and the cycles between them from public code",
	[
		WORKSPACE,
		repositoryHas(
			bundleManifest(),
			{ ...INPUT, content: 'import "plain-kit"; import "./helper.ts";' },
			{ content: 'import "./input.ts";', path: "modules/app/src/bundle/helper.ts" },
			{ content: 'import "./bundle/helper.ts";', path: "modules/app/src/public.ts" },
		),
	],
	function* ({ check, sites }) {
		yield* check(importsManifest);

		expect(yield* sites()).toEqual([`${INPUT.path}:1 plain-kit`]);
	},
);

const CONSUMER = repositoryHas(bundleManifest(), INPUT, {
	content: JSON.stringify({ dependencies: { "@acme/app": "workspace:*" }, name: "consumer-app" }),
	path: "modules/consumer/package.json",
});

importStory.it(
	"imports/manifest reports a blocked bundle input that another member's runtime code reaches",
	[WORKSPACE, CONSUMER, repositoryHas({ content: 'import "../../app/src/bundle/input.ts";', path: "modules/consumer/src/runtime.ts" })],
	function* ({ check, sites }) {
		yield* check(importsManifest);

		expect(yield* sites()).toEqual([`${INPUT.path}:1 plain-kit`]);
	},
);

importStory.it(
	"imports/manifest accepts a blocked bundle input that only another member's test reaches",
	[WORKSPACE, CONSUMER, repositoryHas({ content: 'import "../../app/src/bundle/input.ts";', path: "modules/consumer/src/consumer.test.ts" })],
	function* ({ check }) {
		expect(yield* check(importsManifest)).toEqual([]);
	},
);

for (const [bin, path] of [
	["./dist/bundle/input.js", INPUT.path],
	["./src/bundle/input.ts", INPUT.path],
	["./tooling/cli.ts", "modules/app/tooling/cli.ts"],
	[{ app: "./dist/bundle/input.mjs" }, "modules/app/src/bundle/input.mts"],
	[{ app: "./dist/bundle/input.cjs" }, "modules/app/src/bundle/input.cts"],
] as const) {
	importStory.it(
		`imports/manifest keeps the executable ${path} in the runtime dependency boundary when bin names ${JSON.stringify(bin)}`,
		[WORKSPACE, repositoryHas(bundleManifest(blocked, bin), { ...INPUT, path })],
		function* ({ check, sites }) {
			yield* check(importsManifest);

			expect(yield* sites()).toEqual([`${path}:1 plain-kit`]);
		},
	);
}

for (const [form, exports] of PUBLIC_EXPORTS) {
	importStory.it(
		`imports/manifest honors ${form} that makes a bundle input inside a blocked pattern public`,
		[WORKSPACE, repositoryHas(bundleManifest(exports), INPUT)],
		function* ({ check, sites }) {
			yield* check(importsManifest);

			expect(yield* sites()).toEqual([`${INPUT.path}:1 plain-kit`]);
		},
	);
}

for (const target of ["./src/bundle/input.ts", "./dist/bundle/input.js", "./dist/bundle/input.d.ts"]) {
	importStory.it(
		`imports/manifest reports a blocked bundle input that another export also publishes as ${target}`,
		[WORKSPACE, repositoryHas(bundleManifest({ ...blocked, "./public.ts": target }), INPUT)],
		function* ({ check, sites }) {
			yield* check(importsManifest);

			expect(yield* sites()).toEqual([`${INPUT.path}:1 plain-kit`]);
		},
	);
}
