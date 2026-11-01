import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

const PENDING = '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n';
const LATER = PENDING.replace("Keep a saved draft.", "Restore the latest draft.");

releasePullRequest.it("a conflicting release with successful CI stays frozen", [], function* ({ pushMain, run, git, readGitHub, setCiRun }) {
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	yield* setCiRun("completed", "success");
	const head = yield* git("rev-parse", "origin/release/next");
	yield* pushMain(".changeset/draft.md", LATER);

	expect(yield* run()).toBe("held: CI succeeded");

	yield* outcomes([
		["release head", () => git("rev-parse", "origin/release/next"), head],
		["PR notes", () => readGitHub(), { body: expect.stringContaining("Keep a saved draft.") }],
		["later notes", () => readGitHub(), { body: expect.not.stringContaining("Restore the latest draft.") }],
	]);
});

releasePullRequest.it(
	"a conflicting release in the merge queue is held even with successful CI",
	[],
	function* ({ pushMain, run, git, readGitHub, setCiRun, queue }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* setCiRun("completed", "success");
		yield* queue();
		const head = yield* git("rev-parse", "origin/release/next");
		const before = yield* readGitHub();
		yield* pushMain(".changeset/draft.md", LATER);

		expect(yield* run()).toBe("held: merge queue");

		yield* outcomes([
			["release head", () => git("rev-parse", "origin/release/next"), head],
			["PR notes", () => readGitHub(), { body: before.body }],
		]);
	},
);

for (const [status, conclusion, reason] of [
	["queued", null, "approved CI queued"],
	["in_progress", null, "approved CI in_progress"],
	["completed", "success", "CI succeeded"],
] as const) {
	releasePullRequest.it(
		`${status} approved CI holds a complete release head and PR notes after an unrelated main push`,
		[],
		function* ({ pushMain, run, git, readGitHub, setCiRun }) {
			yield* pushMain(".changeset/draft.md", PENDING);
			yield* run();
			yield* setCiRun(status, conclusion);
			const head = yield* git("rev-parse", "origin/release/next");
			const before = yield* readGitHub();
			yield* pushMain(".changeset/README.md", "Write changesets for public behavior.\n");

			expect(yield* run()).toBe(`held: ${reason}`);

			yield* outcomes([
				["release head", () => git("rev-parse", "origin/release/next"), head],
				["PR metadata", () => readGitHub(), { body: before.body, title: before.title }],
			]);
		},
	);
	releasePullRequest.it(
		`${status} approved CI freezes the release while a newer changeset lands on main`,
		[],
		function* ({ pushMain, run, git, readGitHub, setCiRun }) {
			yield* pushMain(".changeset/draft.md", PENDING);
			yield* run();
			yield* setCiRun(status, conclusion);
			const head = yield* git("rev-parse", "origin/release/next");
			expect((yield* readGitHub()).body).not.toContain("Restore the latest draft.");
			yield* pushMain(".changeset/later.md", LATER);

			expect(yield* run()).toBe(`held: ${reason}`);

			yield* outcomes([
				["release head", () => git("rev-parse", "origin/release/next"), head],
				["original PR notes", () => readGitHub(), { body: expect.stringContaining("Keep a saved draft.") }],
				["later PR notes", () => readGitHub(), { body: expect.not.stringContaining("Restore the latest draft.") }],
			]);
		},
	);
}

for (const conclusion of ["failure", "cancelled"] as const) {
	releasePullRequest.it(
		`${conclusion} after approval lets an unrelated main push refresh the release`,
		[],
		function* ({ pushMain, run, git, readGitHub, setCiRun, check }) {
			yield* pushMain(".changeset/draft.md", PENDING);
			yield* run();
			yield* setCiRun("in_progress");
			const head = yield* git("rev-parse", "origin/release/next");
			yield* pushMain("README.md", "Unrelated main push.\n");
			expect(yield* run()).toBe("held: approved CI in_progress");
			yield* setCiRun("completed", conclusion);
			yield* pushMain("README.md", "Another main push.\n");

			expect(yield* run()).toBe("updated");

			yield* outcomes([
				["release head", () => git("rev-parse", "origin/release/next"), expect.not.stringContaining(head)],
				["original PR notes", () => readGitHub(), { body: expect.stringContaining("Keep a saved draft.") }],
				["released main change", () => git("show", "origin/release/next:README.md"), "Another main push."],
				["validated release", () => check().pipe(Effect.as("valid")), "valid"],
			]);
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
		yield* pushMain("README.md", "Unrelated main push.\n");
		expect(yield* run()).toBe("held: CI succeeded");
		yield* close();
		yield* pushMain(".changeset/later.md", LATER);

		expect(yield* run()).toBe("updated");

		yield* outcomes([
			["release head", () => git("rev-parse", "origin/release/next"), expect.not.stringContaining(head)],
			["reopened PR", () => readGitHub(), { body: expect.stringContaining("Restore the latest draft."), open: true }],
		]);
	},
);
