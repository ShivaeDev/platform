import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { repository } from "#changelog/test-support/repository.ts";
import { releasePackage } from "./releasePackage.ts";

it("checks the tested PR merge against its main parent after intervening releases, while rejecting edits to that history", async () => {
	const fixture = repository();
	try {
		const oldBase = fixture.commit();
		fixture.git("switch", "-c", "change");
		fixture.write("changes/feature.md", "### Added\n\n- Keep a draft.\n");
		fixture.commit();
		fixture.git("switch", "main");
		for (const version of ["1.1.0", "1.2.0"]) {
			fixture.write("changes/main.md", `### Fixed\n\n- Repair ${version}.\n`);
			fixture.version(version);
			await Effect.runPromise(releasePackage(fixture.directory, "2026-10-16").pipe(Effect.provide(NodeFileSystem.layer)));
			fixture.commit();
		}
		fixture.git("merge", "change", "--no-edit");
		function check(event: string, ...args: string[]) {
			return spawnSync(process.execPath, ["--conditions=source", join(process.cwd(), "script/changelog.ts"), "check", ...args], {
				cwd: fixture.root,
				encoding: "utf8",
				env: { "CHANGELOG_BASE_REF": oldBase, "GITHUB_EVENT_NAME": event },
			});
		}
		const pr = check("pull_request");
		assert.equal(pr.status, 0, pr.stderr);
		assert.match(pr.stdout, /Changelog fragments and release notes are valid/u);
		assert.notEqual(check("pull_request", oldBase).status, 0);
		assert.notEqual(check("push").status, 0);
		fixture.write("CHANGELOG.md", fixture.read("CHANGELOG.md").replace("First release.", "Edited history."));
		const changed = check("pull_request");
		assert.notEqual(changed.status, 0);
		assert.match(changed.stderr, /CHANGELOG.md changes only in a release/u);
	} finally {
		fixture.remove();
	}
});
