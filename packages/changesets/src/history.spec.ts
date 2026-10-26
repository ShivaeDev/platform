import { expect } from "@effect/vitest";
import { CORE, HISTORY } from "#test/fixture.ts";
import { pending, workspace } from "#test/workspace.ts";

workspace.it(
	"a public release leaves private packages without changelogs unchanged",
	[pending()],
	function* ({ remove, read, checkpoint, cli, exists }) {
		yield* remove("packages/private/CHANGELOG.md");
		const before = yield* read("packages/private/package.json");
		yield* checkpoint();
		const pendingCheck = yield* cli("check");
		expect(pendingCheck.status, pendingCheck.stderr).toBe(0);
		const applied = yield* cli("apply");
		expect(applied.status, applied.stderr).toBe(0);
		const releaseCheck = yield* cli("check");
		expect(releaseCheck.status, releaseCheck.stderr).toBe(0);
		expect(yield* exists("packages/private/CHANGELOG.md")).toBe(false);
		expect(yield* read("packages/private/package.json")).toBe(before);
	},
);

for (const octopus of [false, true]) {
	workspace.it(
		`check accepts released history from main during a pending ${octopus ? "octopus " : ""}merge`,
		[],
		function* ({ git, write, edit, cli }) {
			yield* write("feature.md", "Feature branch work.\n");
			yield* git("add", ".");
			yield* git("commit", "-m", "Feature work");
			if (octopus) {
				yield* git("switch", "-c", "another-change", "main");
				yield* write("another.md", "Another incoming branch.\n");
				yield* git("add", ".");
				yield* git("commit", "-m", "Another change");
			}
			yield* git("switch", "main");
			yield* edit("packages/core/package.json", (text) => text.replace("0.2.3", "0.2.4"));
			yield* write(
				"packages/core/CHANGELOG.md",
				HISTORY.replace("# Changelog\n", "# Changelog\n\n## 0.2.4 - 2026-10-18\n\n### Fixed\n\n- Released on main.\n"),
			);
			yield* git("add", ".");
			yield* git("commit", "-m", "Release on main");
			yield* git("switch", "feature");
			yield* git("merge", "--no-commit", ...(octopus ? ["another-change", "main"] : ["main"]));
			const accepted = yield* cli("check");
			expect(accepted.status, accepted.stderr).toBe(0);
			yield* edit("packages/core/CHANGELOG.md", (text) => text.replace("Released on main.", "Edited history."));
			const rejected = yield* cli("check");
			expect(rejected.status).toBe(1);
			expect(rejected.stderr).toContain("CHANGELOG.md changes require a version bump");
		},
	);
}

workspace.it("check refuses changelog edits without a version bump", [], function* ({ write, cli }) {
	yield* write("packages/core/CHANGELOG.md", HISTORY.replace("Released history.", "Edited history."));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("CHANGELOG.md changes require a version bump");
});

workspace.it("check refuses a version bump outside a release", [], function* ({ edit, cli }) {
	yield* edit("packages/core/package.json", (text) => text.replace("0.2.3", "0.2.4"));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("run changesets apply");
});

for (const action of ["delete", "edit"] as const) {
	workspace.it(`check refuses a pending changeset ${action} without consumption`, [pending()], function* ({ checkpoint, remove, change, cli }) {
		yield* checkpoint();
		if (action === "delete") {
			yield* remove(".changeset/feature.md");
		} else {
			yield* change("feature", { [CORE]: "patch" }, "### Fixed\n\n- A fix.\n");
		}
		const result = yield* cli("check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("keep pending changesets unchanged");
	});
}
