import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer } from "effect";
import { privateFixture } from "#package-check/test-support/privateFixture.ts";
import { verifyArchives, workspaceArchives } from "./archives.ts";
import { blockedEntries, exportEntries, exportTargets } from "./exports.ts";
import type { Manifest, Package } from "./model.ts";

it("shared archives reject different commits, missing packages, and modified tarballs", async () => {
	const root = mkdtempSync(join(tmpdir(), "platform-archives-"));
	const tarball = join(root, "sample.tgz");
	const pkg: Package = { directory: root, manifest: { name: "sample", version: "1.0.0" }, tarball };
	const entry = { name: "sample", sha256: createHash("sha256").update("archive").digest("hex"), version: "1.0.0" };
	const services = Layer.merge(
		NodeFileSystem.layer,
		Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ "GITHUB_SHA": "expected" })),
	);
	function verify() {
		return Effect.runPromise(verifyArchives([pkg], root).pipe(Effect.provide(services)));
	}
	function inventory(sha: string, packages: readonly (typeof entry)[]) {
		writeFileSync(join(root, "manifest.json"), JSON.stringify({ packages, sha }));
	}
	try {
		writeFileSync(tarball, "archive");
		inventory("expected", [entry]);
		await verify();
		inventory("other", [entry]);
		await assert.rejects(verify, /another commit/u);
		inventory("expected", []);
		await assert.rejects(verify, /inventory does not match/u);
		inventory("expected", [{ ...entry, version: "2.0.0" }]);
		await assert.rejects(verify, /wrong version/u);
		inventory("expected", [entry]);
		writeFileSync(tarball, "changed");
		await assert.rejects(verify, /checksum mismatch/u);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

it("private addons remain covered by packed consumers before a release is authorized", async () => {
	const fixture = privateFixture();
	try {
		const packages = await Effect.runPromise(
			workspaceArchives(fixture.root, join(fixture.root, "archives")).pipe(Effect.provide(NodeFileSystem.layer)),
		);
		assert.equal(packages.length, 1);
		assert.equal(packages[0]?.manifest.private, true);
	} finally {
		fixture.remove();
	}
});

it("checks mapped executables as packed targets without importing them as library entries", () => {
	const manifest: Manifest = {
		bin: { board: "./dist/server/cli.js" },
		exports: {
			"./*.ts": { import: "./dist/server/*.js", source: "./src/server/*.ts" },
			"./board.ts": { import: "./dist/server/board.js", source: "./src/server/board.ts" },
			"./cli.ts": { import: "./dist/server/cli.js", source: "./src/server/cli.ts" },
		},
		name: "board",
		version: "1.0.0",
	};
	const packed = new Set(["src/server/cli.ts", "dist/server/cli.js", "src/server/board.ts", "dist/server/board.js"]);
	assert(exportTargets(manifest, packed).includes("./dist/server/cli.js"));
	const entries = exportEntries(manifest, packed);
	assert(entries.some(({ specifier }) => specifier === "board/board.ts"));
	assert(!entries.some(({ specifier }) => specifier === "board/cli.ts"));
});

it("keeps exact shared exports out of the blocked consumer entries under a private folder pattern", () => {
	const manifest: Manifest = {
		exports: {
			"./*.ts": { import: "./dist/*.js", source: "./src/*.ts" },
			"./browser/responses/*": null,
			"./browser/responses/schema.ts": { import: "./dist/browser/responses/schema.js", source: "./src/browser/responses/schema.ts" },
		},
		name: "board",
		version: "1.0.0",
	};
	const packed = new Set([
		"src/browser/responses/form.ts",
		"src/browser/responses/schema.ts",
		"dist/browser/responses/form.js",
		"dist/browser/responses/schema.js",
	]);
	assert(exportEntries(manifest, packed).some(({ specifier }) => specifier === "board/browser/responses/schema.ts"));
	assert.deepEqual(blockedEntries(manifest, packed), ["board/browser/responses/form.ts"]);
});

it("checks an exact blocked entry when the defining module has an explicit public alias", () => {
	const manifest: Manifest = {
		exports: {
			"./loadQuery.ts": null,
			"./router.ts": { import: "./dist/loadQuery.js", source: "./src/loadQuery.ts" },
		},
		name: "router",
		version: "1.0.0",
	};
	const packed = new Set(["src/loadQuery.ts", "dist/loadQuery.js"]);
	assert.deepEqual(exportEntries(manifest, packed), [{ json: false, specifier: "router/router.ts" }]);
	assert.deepEqual(blockedEntries(manifest, packed), ["router/loadQuery.ts"]);
});
