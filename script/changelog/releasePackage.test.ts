import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { repository } from "#changelog/test-support/repository.ts";
import { collectFragments, parseFragment } from "./fragments.ts";
import { releasePackage } from "./releasePackage.ts";

it("collects fragments under the bumped version in section and filename order, deleting only collected files", async () => {
	const fixture = repository();
	try {
		const history = fixture.read("CHANGELOG.md");
		fixture.version("1.1.0");
		fixture.write("changes/z-query.md", "### Fixed\n\n- Retry a query.\n\n### Added\n\n- Query subscriptions.\n");
		fixture.write(
			"changes/a-editor.md",
			"### Breaking\n\n- Remove the old editor.\n\n### Changed\n\n- Keep draft state.\n\n### Added\n\n- Save drafts.\n",
		);
		fixture.write("changes/.gitkeep", "");
		const count = await Effect.runPromise(releasePackage(fixture.directory, "2026-10-11").pipe(Effect.provide(NodeFileSystem.layer)));
		assert.equal(count, 2);
		assert.equal(
			fixture.read("CHANGELOG.md"),
			`# Changelog\n\n## 1.1.0 - 2026-10-11\n\n### Added\n\n- Save drafts.\n- Query subscriptions.\n\n### Changed\n\n- Keep draft state.\n\n### Fixed\n\n- Retry a query.\n\n### Breaking\n\n- Remove the old editor.\n\n${history.slice("# Changelog\n\n".length)}`,
		);
		assert.equal(existsSync(join(fixture.directory, "changes", "a-editor.md")), false);
		assert.equal(existsSync(join(fixture.directory, "changes", "z-query.md")), false);
		assert.equal(existsSync(join(fixture.directory, "changes", ".gitkeep")), true);
		assert.deepEqual(JSON.parse(fixture.read("release.json")), {
			date: "2026-10-11",
			fragments: [
				{
					name: "a-editor.md",
					text: "### Breaking\n\n- Remove the old editor.\n\n### Changed\n\n- Keep draft state.\n\n### Added\n\n- Save drafts.\n",
				},
				{ name: "z-query.md", text: "### Fixed\n\n- Retry a query.\n\n### Added\n\n- Query subscriptions.\n" },
			],
			version: "1.1.0",
		});
	} finally {
		fixture.remove();
	}
});

it("leaves the changelog unchanged for an empty fragment set and on repeated collection", async () => {
	const fixture = repository();
	try {
		const history = fixture.read("CHANGELOG.md");
		assert.equal(await Effect.runPromise(releasePackage(fixture.directory, "2026-10-11").pipe(Effect.provide(NodeFileSystem.layer))), 0);
		assert.equal(fixture.read("CHANGELOG.md"), history);
		fixture.version("1.1.0");
		fixture.write("changes/drafts.md", "### Added\n\n- Save drafts.\n");
		await Effect.runPromise(releasePackage(fixture.directory, "2026-10-11").pipe(Effect.provide(NodeFileSystem.layer)));
		const released = fixture.read("CHANGELOG.md");
		const manifest = fixture.read("release.json");
		assert.equal(await Effect.runPromise(releasePackage(fixture.directory, "2026-10-11").pipe(Effect.provide(NodeFileSystem.layer))), 0);
		assert.equal(fixture.read("CHANGELOG.md"), released);
		assert.equal(fixture.read("release.json"), manifest);
	} finally {
		fixture.remove();
	}
});

it("rejects malformed fragments and collecting notes into an already released version before writing", async () => {
	assert.throws(() => parseFragment({ name: "invalid.md", text: "### Other\n\n- Entry." }), /use Added/u);
	assert.throws(() => parseFragment({ name: "empty.md", text: "### Fixed\n" }), /must contain an entry/u);
	assert.throws(() => parseFragment({ name: "empty-entry.md", text: "### Fixed\n\n- " }), /start each entry|must have text/u);
	assert.throws(() => parseFragment({ name: "no-section.md", text: "- Entry." }), /heading/u);
	const fixture = repository();
	try {
		const history = fixture.read("CHANGELOG.md");
		fixture.write("changes/drafts.md", "### Added\n\n- Save drafts.\n");
		await assert.rejects(
			() => Effect.runPromise(releasePackage(fixture.directory, "2026-10-11").pipe(Effect.provide(NodeFileSystem.layer))),
			/bump the package version/u,
		);
		assert.equal(fixture.read("CHANGELOG.md"), history);
		assert.equal(existsSync(join(fixture.directory, "changes", "drafts.md")), true);
		assert.throws(
			() => collectFragments("# Changelog\n\n## Unreleased\n", "1.1.0", "2026-10-11", [{ name: "a.md", text: "### Added\n\n- Entry." }]),
			/Unreleased/u,
		);
	} finally {
		fixture.remove();
	}
});
