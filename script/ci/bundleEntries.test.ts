import assert from "node:assert/strict";
import { it } from "node:test";
import { bundleEntries } from "#ci/bundleEntries.ts";

it("bundle entries include public JavaScript subpaths and CLIs once, excluding source, types and assets", () => {
	assert.deepEqual(
		bundleEntries("/repo/packages/future", {
			bin: { future: "./dist/bin/cli.js" },
			exports: {
				".": { default: "./dist/index.js", import: "./dist/index.js", source: "./src/index.ts", types: "./dist/index.d.ts" },
				"./client": { import: "./dist/client.js" },
				"./package.json": "./package.json",
			},
			name: "@shivaedev/future",
			version: "1.0.0",
		}),
		{
			"bin/cli": "/repo/packages/future/dist/bin/cli.js",
			client: "/repo/packages/future/dist/client.js",
			index: "/repo/packages/future/dist/index.js",
		},
	);
});

it("a future type-only package needs no bundle", () => {
	assert.deepEqual(bundleEntries("/repo/packages/types", { exports: { ".": "./dist/index.d.ts" }, name: "types", version: "1.0.0" }), {});
});
