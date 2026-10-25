import { expect } from "vitest";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

const PENDING = '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n';
const LATER = PENDING.replace("Keep a saved draft.", "Restore the latest draft.");

for (const [status, conclusion, reason] of [
	["queued", null, "approved CI queued"],
	["in_progress", null, "approved CI in_progress"],
	["completed", "success", "CI succeeded"],
] as const) {
	releasePullRequest.it(
		`${status} approved CI holds the release head and PR notes while main receives changesets`,
		[],
		function* ({ pushMain, run, git, readGitHub, setCiRun }) {
			yield* pushMain(".changeset/draft.md", PENDING);
			yield* run();
			yield* setCiRun(status, conclusion);
			const head = yield* git("rev-parse", "origin/release/next");
			const before = yield* readGitHub();
			yield* pushMain(".changeset/later.md", LATER);
			expect(yield* run()).toBe(`held: ${reason}`);
			expect(yield* git("rev-parse", "origin/release/next")).toBe(head);
			expect((yield* readGitHub()).body).toBe(before.body);
			expect(yield* git("show", "origin/main:.changeset/later.md")).toContain("Restore the latest draft.");
		},
	);
}

for (const conclusion of ["failure", "cancelled"] as const) {
	releasePullRequest.it(
		`${conclusion} after approval lets the next push include all pending changesets`,
		[],
		function* ({ pushMain, run, git, readGitHub, setCiRun, check }) {
			yield* pushMain(".changeset/draft.md", PENDING);
			yield* run();
			yield* setCiRun("in_progress");
			const head = yield* git("rev-parse", "origin/release/next");
			yield* pushMain(".changeset/later.md", LATER);
			expect(yield* run()).toBe("held: approved CI in_progress");
			yield* setCiRun("completed", conclusion);
			yield* pushMain("README.md", "Another main push.\n");
			expect(yield* run()).toBe("updated");
			expect(yield* git("rev-parse", "origin/release/next")).not.toBe(head);
			const after = yield* readGitHub();
			expect(after.body).toContain("Keep a saved draft.");
			expect(after.body).toContain("Restore the latest draft.");
			yield* check();
		},
	);
}

releasePullRequest.it(
	"closing an approved release lets the next push regenerate it",
	[],
	function* ({ pushMain, run, git, close, setCiRun, readGitHub }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* setCiRun("completed", "success");
		const head = yield* git("rev-parse", "origin/release/next");
		yield* pushMain(".changeset/later.md", LATER);
		expect(yield* run()).toBe("held: CI succeeded");
		yield* close();
		yield* pushMain("README.md", "Another main push.\n");
		expect(yield* run()).toBe("updated");
		expect(yield* git("rev-parse", "origin/release/next")).not.toBe(head);
		const after = yield* readGitHub();
		expect(after.open).toBe(true);
		expect(after.body).toContain("Restore the latest draft.");
	},
);

releasePullRequest.it(
	"merging a held release leaves later changesets for the next release",
	[],
	function* ({ pushMain, run, git, close, setCiRun, readGitHub, check }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* setCiRun("completed", "success");
		const head = yield* git("rev-parse", "origin/release/next");
		yield* pushMain(".changeset/later.md", LATER);
		expect(yield* run()).toBe("held: CI succeeded");
		yield* git("merge", "--no-edit", "release/next");
		yield* git("push", "origin", "main");
		yield* close();
		expect(yield* run()).toBe("updated");
		expect(yield* git("rev-parse", "origin/release/next")).not.toBe(head);
		expect(yield* git("show", "origin/main:.changeset/later.md")).toContain("Restore the latest draft.");
		expect(yield* git("ls-tree", "--name-only", "origin/main:.changeset")).not.toContain("draft.md");
		expect(yield* git("show", "origin/release/next:packages/platform/package.json")).toContain('"version": "0.15.2"');
		const after = yield* readGitHub();
		expect(after.body).toContain("Restore the latest draft.");
		expect(after.body).not.toContain("Keep a saved draft.");
		yield* check();
	},
);
