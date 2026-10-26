import { expect } from "@effect/vitest";
import { HISTORY } from "#test/fixture.ts";
import { workspace } from "#test/workspace.ts";

workspace.it(
	"a declared rename may move folders while preserving its version and released history",
	[],
	function* ({ change, checkpoint, edit, move, cli, read, packageVersion }) {
		yield* change("rename", { "@test/renamed": "minor" }, "### Breaking\n\n- Rename `@test/core` to `@test/renamed`; use the new package name.\n");
		yield* checkpoint();
		for (const directory of ["core", "api", "private", "dev"]) {
			yield* edit(`packages/${directory}/package.json`, (text) => text.replaceAll("@test/core", "@test/renamed"));
		}
		yield* move("packages/core", "packages/renamed");
		const pending = yield* cli("check");
		expect(pending.status, pending.stderr).toBe(0);
		expect(yield* packageVersion("packages/renamed")).toBe("0.2.3");
		expect(yield* read("packages/renamed/CHANGELOG.md")).toBe(HISTORY);
		yield* edit("packages/renamed/CHANGELOG.md", (text) => text.replace("Released history.", "Rewritten history."));
		const rewritten = yield* cli("check");
		expect(rewritten.status).toBe(1);
		expect(rewritten.stderr).toContain("CHANGELOG.md changes require a version bump");
		yield* edit("packages/renamed/CHANGELOG.md", (text) => text.replace("Rewritten history.", "Released history."));
		const applied = yield* cli("apply");
		expect(applied.status, applied.stderr).toBe(0);
		expect(yield* packageVersion("packages/renamed")).toBe("0.3.0");
		const released = yield* cli("check");
		expect(released.status, released.stderr).toBe(0);
		expect(yield* read("packages/renamed/CHANGELOG.md")).toContain(`\n${HISTORY.slice("# Changelog\n".length).trimStart()}`);
		yield* edit("packages/renamed/CHANGELOG.md", (text) => text.replace("Released history.", "Rewritten history."));
		const rewrittenRelease = yield* cli("check");
		expect(rewrittenRelease.status).toBe(1);
		expect(rewrittenRelease.stderr).toContain("restore released history");
	},
);

workspace.it("a folder move requires a rename declaration and explains how to add it", [], function* ({ edit, move, change, cli }) {
	yield* edit("packages/dev/package.json", (text) => text.replace("@test/dev", "@test/renamed"));
	yield* move("packages/dev", "packages/renamed");
	const undeclared = yield* cli("check");
	expect(undeclared.status).toBe(1);
	expect(undeclared.stderr).toContain("@test/dev: declare its rename or removal");
	expect(undeclared.stderr).toContain(".changeset/<name>.md");
	expect(undeclared.stderr).toContain("### Breaking");
	expect(undeclared.stderr).toContain("name the new package and its bump in frontmatter");
	yield* change("rename", { "@test/renamed": "minor" }, "### Breaking\n\n- Rename `@test/dev` to `@test/renamed`; use the new package name.\n");
	const declared = yield* cli("check");
	expect(declared.status, declared.stderr).toBe(0);
});
