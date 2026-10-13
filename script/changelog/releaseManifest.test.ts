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

it("validates all same-PR release inputs after the intermediate fragment commits are squashed", async () => {
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
		fixture.git("reset", "--soft", base);
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

it("rejects edited or omitted base fragments in a same-PR release manifest", async () => {
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
			await assert.rejects(() => check(fixture.root, base), /collect every existing fragment unchanged/u);
		} finally {
			fixture.remove();
		}
	}
});

it("requires a release manifest to match its version, date and unique fragment inputs", async () => {
	const fixture = repository();
	try {
		const base = fixture.commit();
		fixture.write("changes/new.md", "### Added\n\n- New behavior.\n");
		fixture.version("1.1.0");
		await Effect.runPromise(releasePackage(fixture.directory, "2026-10-13").pipe(Effect.provide(NodeFileSystem.layer)));
		await check(fixture.root, base);
		const manifest = fixture.read("release.json");
		fixture.write("release.json", manifest.replace('"version": "1.1.0"', '"version": "1.2.0"'));
		await assert.rejects(() => check(fixture.root, base), /version and date/u);
		fixture.write("release.json", manifest.replace("2026-10-13", "2026-10-14"));
		await assert.rejects(() => check(fixture.root, base), /version and date/u);
		fixture.write(
			"release.json",
			JSON.stringify({
				date: "2026-10-13",
				fragments: new Array(2).fill({ name: "new.md", text: "### Added\n\n- New behavior.\n" }),
				version: "1.1.0",
			}),
		);
		await assert.rejects(() => check(fixture.root, base), /unique fragment names/u);
		fixture.write("release.json", manifest);
		fixture.commit();
		fixture.write("release.json", manifest.replace("New behavior.", "Edited behavior."));
		await assert.rejects(() => check(fixture.root, "HEAD"), /release.json changes only in a release/u);
	} finally {
		fixture.remove();
	}
});
