import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer } from "effect";
import { verifyArchives } from "./archives.ts";
import type { Package } from "./model.ts";

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
