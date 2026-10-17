import assert from "node:assert/strict";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { repository } from "#changelog/test-support/repository.ts";
import type { Manifest } from "#package-check/model.ts";
import { checkRepository } from "./checkRepository.ts";
import { assertDependentReleases, assertStarterPins } from "./versionAgreement.ts";

const sql: Manifest = { name: "@shivaedev/effect-sql", version: "0.4.0" };
const testSql: Manifest = { dependencies: { [sql.name]: "workspace:*" }, name: "@shivaedev/effect-test-sql", version: "0.3.0" };

it("names every unreleased published dependent of a version bump, including optional dependencies and peers", () => {
	const peer = { name: "peer", peerDependencies: { [sql.name]: "workspace:*" }, version: "1.0.0" };
	const optional = { name: "optional", optionalDependencies: { [sql.name]: "0.3.0" }, version: "1.0.0" };
	const packages = [
		{ before: { ...sql, version: "0.3.0" }, manifest: sql },
		...[testSql, peer, optional].map((manifest) => ({ before: manifest, manifest })),
	];
	assert.throws(
		() => assertDependentReleases(packages),
		(error: unknown) => {
			assert.ok(error instanceof Error);
			for (const name of [testSql.name, peer.name, optional.name]) {
				assert.ok(error.message.includes(`${name} depends on ${sql.name}@0.4.0`));
			}
			assert.match(error.message, /Bump each dependent.*changelog:release/u);
			return true;
		},
	);
	const released = packages.map((pkg) => ({ ...pkg, manifest: { ...pkg.manifest, version: "0.4.0" } }));
	assert.throws(() => assertDependentReleases(released), /optional: update @shivaedev\/effect-sql from 0.3.0 to 0.4.0/u);
	assert.doesNotThrow(() =>
		assertDependentReleases(
			released.map((pkg) =>
				pkg.manifest.name === optional.name ? { ...pkg, manifest: { ...pkg.manifest, optionalDependencies: { [sql.name]: "0.4.0" } } } : pkg,
			),
		),
	);
});

it("ignores development-only and private dependents and checks cascading releases", () => {
	const app = { dependencies: { [sql.name]: "workspace:*" }, name: "app", private: true, version: "1.0.0" };
	const dev = { devDependencies: { [sql.name]: "workspace:*" }, name: "dev", version: "1.0.0" };
	const consumer = { dependencies: { [testSql.name]: "workspace:*" }, name: "consumer", version: "1.0.0" };
	const releases = [
		{ before: sql, manifest: { ...sql, version: "0.4.1" } },
		{ before: testSql, manifest: { ...testSql, version: "0.3.1" } },
		...[app, dev].map((manifest) => ({ before: manifest, manifest })),
	];
	assert.doesNotThrow(() => assertDependentReleases(releases));
	assert.throws(
		() => assertDependentReleases([...releases, { before: consumer, manifest: consumer }]),
		/consumer depends on @shivaedev\/effect-test-sql/u,
	);
});

it("rejects starter pins that would install two framework versions and names the dependent and fix", () => {
	const pins = { [sql.name]: sql.version, [testSql.name]: testSql.version };
	const exact = { ...testSql, dependencies: { [sql.name]: "0.3.0" } };
	assert.throws(
		() => assertStarterPins([sql, exact], pins),
		/effect-test-sql@0.3.0 depends on @shivaedev\/effect-sql@0.3.0.*Align.*release create-app/u,
	);
	assert.throws(() => assertStarterPins([sql, testSql], { ...pins, [sql.name]: "0.3.0" }), /effect-sql@0.3.0 must pin the current release 0.4.0/u);
	assert.throws(() => assertStarterPins([sql, testSql], { [testSql.name]: testSql.version }), /effect-sql@0.4.0.*missing/u);
	assert.doesNotThrow(() => assertStarterPins([sql, testSql], pins));
});

it("the changelog check rejects omitted dependent releases and conflicting starter pins", async () => {
	const fixture = repository();
	const oldSql = { ...sql, version: "0.3.0" };

	function check(base: string) {
		return Effect.runPromise(checkRepository(fixture.root, base).pipe(Effect.provide(NodeFileSystem.layer)));
	}
	try {
		fixture.write("package.json", JSON.stringify(oldSql));
		fixture.write("../effect-test-sql/package.json", JSON.stringify(testSql));
		fixture.write("../effect-test-sql/CHANGELOG.md", fixture.read("CHANGELOG.md"));
		const pins = { [sql.name]: oldSql.version, [testSql.name]: testSql.version };
		fixture.write("../../examples/starter/published-versions.json", JSON.stringify(pins));
		const base = fixture.commit();
		await check(base);
		fixture.write("package.json", JSON.stringify(sql));
		await assert.rejects(() => check(base), /effect-test-sql depends on @shivaedev\/effect-sql@0.4.0.*Bump each dependent/u);
		fixture.write("../effect-test-sql/package.json", JSON.stringify({ ...testSql, version: "0.3.1" }));
		await assert.rejects(() => check(base), /effect-sql@0.3.0 must pin the current release 0.4.0/u);
		fixture.write("../../examples/starter/published-versions.json", JSON.stringify({ [sql.name]: "0.4.0", [testSql.name]: "0.3.1" }));
		await check(base);
	} finally {
		fixture.remove();
	}
});
