import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { repository } from "#changelog/test-support/repository.ts";
import { checkRepository } from "./checkRepository.ts";
import { migrateUnreleased } from "./fragments.ts";
import { releasePackage } from "./releasePackage.ts";

function check(root: string, base: string) {
	return Effect.runPromise(checkRepository(root, base).pipe(Effect.provide(NodeFileSystem.layer)));
}

it("accepts independent PR fragments and rejects direct changelog edits through the real check command", async () => {
	const fixture = repository();
	try {
		const base = fixture.commit();
		fixture.git("branch", "origin/main", base);
		fixture.write("changes/editor.md", "### Added\n\n- Save drafts.\n");
		fixture.commit();
		await check(fixture.root, "origin/main");
		fixture.git("switch", "-c", "query", base);
		fixture.write("changes/query.md", "### Fixed\n\n- Retry queries.\n");
		fixture.commit();
		fixture.git("merge", "main", "--no-edit");
		await check(fixture.root, base);
		assert.match(fixture.read("changes/editor.md"), /Save drafts/u);
		assert.match(fixture.read("changes/query.md"), /Retry queries/u);
		fixture.write("CHANGELOG.md", fixture.read("CHANGELOG.md").replace("First release.", "Changed history."));
		const result = spawnSync(process.execPath, ["--conditions=source", join(process.cwd(), "script/changelog.ts"), "check", base], {
			cwd: fixture.root,
			encoding: "utf8",
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /CHANGELOG.md changes only in a release/u);
	} finally {
		fixture.remove();
	}
});

it("requires the collector output, version bump and deletion of collected fragments for a release", async () => {
	const fixture = repository();
	try {
		fixture.write("changes/editor.md", "### Fixed\n\n- Save drafts.\n");
		const base = fixture.commit();
		fixture.version("1.1.0");
		await assert.rejects(() => check(fixture.root, base), /collect the release fragments/u);
		await Effect.runPromise(releasePackage(fixture.directory, "2026-10-11").pipe(Effect.provide(NodeFileSystem.layer)));
		await check(fixture.root, base);
		fixture.write("changes/editor.md", "### Fixed\n\n- Save drafts.\n");
		await assert.rejects(() => check(fixture.root, base), /collect and delete/u);
		rmSync(join(fixture.directory, "changes/editor.md"));
		fixture.write("CHANGELOG.md", fixture.read("CHANGELOG.md").replace("First release.", "Changed history."));
		await assert.rejects(() => check(fixture.root, base), /released history cannot be edited/u);
	} finally {
		fixture.remove();
	}
});

it("permits only a lossless migration of legacy Unreleased entries and leaves released history intact", async () => {
	const fixture = repository();
	try {
		const history = fixture.read("CHANGELOG.md");
		fixture.write(
			"CHANGELOG.md",
			history.replace("# Changelog\n\n", "# Changelog\n\n## Unreleased\n\n### Fixed\n\n- Retry queries.\n  Keep interruption.\n\n"),
		);
		const base = fixture.commit();
		await assert.rejects(() => check(fixture.root, base), /without an Unreleased section/u);
		const migration = migrateUnreleased(fixture.read("CHANGELOG.md"));
		assert.ok(migration);
		fixture.write("CHANGELOG.md", migration.changelog);
		fixture.write("changes/previous.md", migration.fragment);
		assert.equal(migration.changelog, history);
		await check(fixture.root, base);
		fixture.write("changes/previous.md", "### Fixed\n\n- Different entry.\n");
		await assert.rejects(() => check(fixture.root, base), /changes only in a release/u);
		assert.equal(migrateUnreleased("# Changelog\n\n## Unreleased\n\n- Initial behavior.\n")?.fragment, "### Added\n\n- Initial behavior.\n");
		assert.deepEqual(migrateUnreleased("# Changelog\n\n## Unreleased\n"), { changelog: "# Changelog\n", fragment: "" });
	} finally {
		fixture.remove();
	}
});

it("requires each PR to add a new fragment instead of editing or deleting another PR's notes", async () => {
	const fixture = repository();
	try {
		fixture.write("changes/editor.md", "### Added\n\n- Save drafts.\n");
		const base = fixture.commit();
		fixture.write("changes/editor.md", "### Added\n\n- Different behavior.\n");
		await assert.rejects(() => check(fixture.root, base), /keep existing fragments intact/u);
		rmSync(join(fixture.directory, "changes/editor.md"));
		await assert.rejects(() => check(fixture.root, base), /keep existing fragments intact/u);
	} finally {
		fixture.remove();
	}
});
