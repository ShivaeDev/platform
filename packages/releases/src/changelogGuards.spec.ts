import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { pending, released, workspace } from "#test/workspace.ts";

for (const changelog of ["# Notes\n", "# Changelog\n\n## Unreleased\n\n### Added\n\n- A pending entry.\n"]) {
	workspace.it("apply explains the required released-history format", [pending()], function* ({ write, checkpoint, cli }) {
		yield* write("packages/core/CHANGELOG.md", changelog);
		yield* checkpoint();
		const result = yield* cli("apply");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.stderr).toContain("use a '# Changelog' title and move Unreleased notes");
	});
}

workspace.it("apply refuses collecting into a version that already has notes", [pending(), released], function* ({ checkpoint, change, edit, cli }) {
	yield* checkpoint();
	yield* change("next", { [CORE]: "minor" });
	yield* edit("packages/core/package.json", (text) => text.replace("0.3.0", "0.2.3"));
	const result = yield* cli("apply");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("version 0.3.0 already has notes");
});
