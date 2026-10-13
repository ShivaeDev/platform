import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { repository } from "#changelog/test-support/repository.ts";
import { checkRepository } from "./checkRepository.ts";
import { releasePackage } from "./releasePackage.ts";

function check(root: string, base: string) {
	return Effect.runPromise(checkRepository(root, base).pipe(Effect.provide(NodeFileSystem.layer)));
}

it("validates a same-PR release against all committed pending fragments before and after the release commit", async () => {
	const fixture = repository();
	try {
		fixture.write("changes/existing.md", "### Fixed\n\n- Existing fix.\n");
		const base = fixture.commit();
		fixture.write("changes/new.md", "### Added\n\n- New behavior.\n");
		fixture.commit();
		fixture.version("1.1.0");
		await Effect.runPromise(releasePackage(fixture.directory, "2026-10-13").pipe(Effect.provide(NodeFileSystem.layer)));
		await check(fixture.root, base);
		fixture.commit();
		await check(fixture.root, base);
		const released = fixture.read("CHANGELOG.md");
		fixture.write("CHANGELOG.md", released.replace("- New behavior.\n", ""));
		await assert.rejects(() => check(fixture.root, base), /release notes must match/u);
		fixture.write("CHANGELOG.md", released.replace("First release.", "Edited history."));
		await assert.rejects(() => check(fixture.root, base), /released history cannot be edited/u);
		fixture.write("CHANGELOG.md", released);
		fixture.write("changes/new.md", "### Added\n\n- New behavior.\n");
		await assert.rejects(() => check(fixture.root, base), /collect and delete/u);
	} finally {
		fixture.remove();
	}
});

it("rejects committed edits or deletion of base fragments before collecting a same-PR release", async () => {
	for (const edit of [true, false]) {
		const fixture = repository();
		try {
			fixture.write("changes/existing.md", "### Fixed\n\n- Existing fix.\n");
			const base = fixture.commit();
			if (edit) {
				fixture.write("changes/existing.md", "### Fixed\n\n- Edited fix.\n");
			} else {
				rmSync(join(fixture.directory, "changes/existing.md"));
			}
			fixture.write("changes/new.md", "### Added\n\n- New behavior.\n");
			fixture.commit();
			fixture.version("1.1.0");
			await Effect.runPromise(releasePackage(fixture.directory, "2026-10-13").pipe(Effect.provide(NodeFileSystem.layer)));
			await assert.rejects(() => check(fixture.root, base), /keep existing fragments intact/u);
		} finally {
			fixture.remove();
		}
	}
});
