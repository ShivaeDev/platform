import assert from "node:assert/strict";
import { test as it } from "node:test";
import { bundleEntries } from "./bundleEntries.ts";

const packed = new Set([
	"package.json",
	"dist/index.js",
	"dist/index.d.ts",
	"dist/client.js",
	"dist/cli.js",
	"src/index.ts",
	"src/client.ts",
	"src/cli.ts",
]);

it("bundle entries are the packed JavaScript behind every exported module and executable, once each", () => {
	assert.deepEqual(
		bundleEntries(
			{
				bin: { future: "./dist/cli.js" },
				exports: {
					"./*.ts": { default: "./dist/*.js", import: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" },
					"./package.json": "./package.json",
				},
				name: "@shivaedev/future",
				version: "1.0.0",
			},
			packed,
		),
		{ cli: "dist/cli.js", client: "dist/client.js", index: "dist/index.js" },
	);
});

it("a package that exports only declarations needs no bundle", () => {
	assert.deepEqual(bundleEntries({ exports: { "./*.ts": { types: "./dist/*.d.ts" } }, name: "types", version: "1.0.0" }, packed), {});
});
