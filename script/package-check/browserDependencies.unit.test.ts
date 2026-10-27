import assert from "node:assert/strict";
import { it } from "vitest";
import { dependencyEntry } from "#package-check/browserDependencies.ts";
import type { Package } from "#package-check/model.ts";

function workspacePackage(name: string, manifest: Partial<Package["manifest"]> = {}): Package {
	return { directory: `packages/${name}`, manifest: { name: `@shivaedev/${name}`, version: "0.0.0", ...manifest }, tarball: `${name}.tgz` };
}

const errors = workspacePackage("errors");
const entries = { "errors": ["./taxonomy.ts"] };

it("follows a declared browser entry of a workspace dependency", () => {
	const platform = workspacePackage("platform", { dependencies: { "@shivaedev/errors": "workspace:*" } });
	assert.equal(dependencyEntry(platform, [errors, platform], entries, "@shivaedev/errors/taxonomy.ts"), errors);
});

it("rejects a workspace module that is not a declared browser entry", () => {
	const platform = workspacePackage("platform", { dependencies: { "@shivaedev/errors": "workspace:*" } });
	assert.equal(dependencyEntry(platform, [errors, platform], entries, "@shivaedev/errors/redact.ts"), undefined);
});

it("rejects a browser entry of a package the importer only develops against", () => {
	const platform = workspacePackage("platform", { devDependencies: { "@shivaedev/errors": "workspace:*" } });
	assert.equal(dependencyEntry(platform, [errors, platform], entries, "@shivaedev/errors/taxonomy.ts"), undefined);
});

it("rejects a package outside the workspace", () => {
	const platform = workspacePackage("platform", { dependencies: { "better-auth": "1.0.0" } });
	assert.equal(dependencyEntry(platform, [errors, platform], entries, "better-auth/client"), undefined);
});
