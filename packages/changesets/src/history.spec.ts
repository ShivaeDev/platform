import { expect } from "@effect/vitest";
import { CORE, HISTORY } from "#test/fixture.ts";
import { pending, workspace } from "#test/workspace.ts";

workspace.it("check refuses changelog edits without a version bump", [], function* ({ write, cli }) {
	yield* write("packages/core/CHANGELOG.md", HISTORY.replace("Released history.", "Edited history."));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("CHANGELOG.md changes require a version bump");
});

workspace.it("check refuses a version bump without a release manifest", [], function* ({ edit, cli }) {
	yield* edit("packages/core/package.json", (text) => text.replace("0.2.3", "0.2.4"));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("A release needs .changeset/release.json");
});

for (const action of ["delete", "edit"] as const) {
	workspace.it(`check refuses a pending changeset ${action} without consumption`, [pending()], function* ({ checkpoint, remove, change, cli }) {
		yield* checkpoint();
		if (action === "delete") {
			yield* remove(".changeset/feature.md");
		} else {
			yield* change("feature", { [CORE]: "patch" });
		}
		const result = yield* cli("check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("keep pending changesets unchanged");
	});
}

workspace.it("check refuses a release manifest change without a version bump", [], function* ({ write, cli }) {
	yield* write(".changeset/release.json", JSON.stringify({ date: "2026-10-18", plan: { changesets: [], releases: [] } }));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("changes only with a release");
});
