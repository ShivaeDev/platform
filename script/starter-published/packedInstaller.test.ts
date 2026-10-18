import assert from "node:assert/strict";
import { test as it } from "node:test";
import { withTarballOverrides } from "#withTarballOverrides.ts";

it("nested setup, install and hook commands keep one tarball override per package", () => {
	const tarballs = { "@shivaedev/platform": "/tmp/platform.tgz" };
	let workspace = "packages: []\n";
	for (const _command of ["run setup", "install", "exec quality hooks install", "run typecheck"]) {
		workspace = withTarballOverrides(workspace, tarballs);
		assert.equal(workspace, 'packages: []\n\noverrides:\n  "@shivaedev/platform": "file:/tmp/platform.tgz"\n');
	}
});

it("replacing a tarball preserves other overrides and the same package's catalog entry", () => {
	const source =
		'packages: []\n\noverrides:\n  "@shivaedev/platform": "file:/tmp/old.tgz"\n  effect: 4.0.4\n\ncatalog:\n  "@shivaedev/platform": 0.9.0\n';
	assert.equal(
		withTarballOverrides(source, { "@shivaedev/platform": "/tmp/new.tgz" }),
		'packages: []\n\noverrides:\n  "@shivaedev/platform": "file:/tmp/new.tgz"\n  effect: 4.0.4\n\ncatalog:\n  "@shivaedev/platform": 0.9.0\n',
	);
});
