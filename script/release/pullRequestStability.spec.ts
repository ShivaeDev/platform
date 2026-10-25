import { expect } from "vitest";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

const PENDING = '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n';

releasePullRequest.it(
	"unrelated main pushes leave the release head and waiting PR untouched, even after midnight",
	[],
	function* ({ pushMain, run, git, readGitHub }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run("2026-10-17");
		const head = yield* git("rev-parse", "origin/release/next");
		const before = yield* readGitHub();
		yield* pushMain("README.md", "A documentation change.\n");
		expect(yield* run("2026-10-18")).toBe("unchanged");
		expect(yield* git("rev-parse", "origin/release/next")).toBe(head);
		const after = yield* readGitHub();
		expect(after.body).toBe(before.body);
		expect(after.requests.slice(before.requests.length).map((request) => request.endpoint)).toEqual([
			"graphql",
			`repos/example/workspace/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${head}&per_page=1`,
		]);
		expect(yield* git("status", "--porcelain")).toBe("");
	},
);

releasePullRequest.it(
	"a missing PR opens on the unchanged standing branch without replacing its head",
	[],
	function* ({ pushMain, run, git, close, readGitHub }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		const head = yield* git("rev-parse", "origin/release/next");
		yield* close();
		yield* pushMain("README.md", "A documentation change.\n");
		expect(yield* run()).toBe("unchanged");
		expect(yield* git("rev-parse", "origin/release/next")).toBe(head);
		const received = yield* readGitHub();
		expect(received.open).toBe(true);
		expect(received.requests.filter((request) => request.method === "POST" && request.endpoint.endsWith("/pulls"))).toMatchObject([
			{ body: { base: "main", head: "release/next" } },
			{ body: { base: "main", head: "release/next" } },
		]);
	},
);

releasePullRequest.it("an edited changeset replaces the applied release and PR notes", [], function* ({ pushMain, run, git, readGitHub }) {
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	const head = yield* git("rev-parse", "origin/release/next");
	yield* pushMain(".changeset/draft.md", PENDING.replace("Keep a saved draft.", "Restore the latest draft."));
	expect(yield* run()).toBe("updated");
	expect(yield* git("rev-parse", "origin/release/next")).not.toBe(head);
	expect((yield* readGitHub()).body).toContain("Restore the latest draft.");
});

releasePullRequest.it("removing a pending changeset removes its notes from the standing release", [], function* ({ pushMain, run, git, readGitHub }) {
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* pushMain(".changeset/removed.md", PENDING.replace("Keep a saved draft.", "A withdrawn fix."));
	yield* run();
	yield* git("switch", "main");
	yield* git("rm", ".changeset/removed.md");
	yield* git("commit", "-m", "Withdraw pending fix");
	yield* git("push", "origin", "main");
	expect(yield* run()).toBe("updated");
	expect((yield* readGitHub()).body).not.toContain("A withdrawn fix.");
	expect(yield* git("show", "origin/release/next:packages/platform/CHANGELOG.md")).not.toContain("A withdrawn fix.");
});

releasePullRequest.it("changed changelog inputs regenerate on current main", [], function* ({ pushMain, run, git, check }) {
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	const head = yield* git("rev-parse", "origin/release/next");
	yield* pushMain("packages/platform/CHANGELOG.md", "# Changelog\n\n## Earlier history\n\n- Restore a historical entry.\n");
	expect(yield* run()).toBe("updated");
	expect(yield* git("rev-parse", "origin/release/next")).not.toBe(head);
	expect(yield* git("rev-parse", "origin/release/next^")).toBe(yield* git("rev-parse", "origin/main"));
	expect(yield* git("show", "origin/release/next:packages/platform/CHANGELOG.md")).toContain("Restore a historical entry.");
	yield* check();
});

releasePullRequest.it("a conflicting branch regenerates even when the release plan is unchanged", [], function* ({ pushMain, run, git }) {
	yield* pushMain("README.md", "Original documentation.\n");
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	yield* git("switch", "main");
	yield* pushMain("README.md", "Current documentation.\n");
	yield* git("switch", "release/next");
	yield* git("restore", "--source=main", "README.md");
	yield* git("commit", "-am", "Change release branch documentation");
	yield* git("push", "origin", "release/next");
	const head = yield* git("rev-parse", "origin/release/next");
	yield* pushMain("README.md", "Conflicting main documentation.\n");
	expect(yield* run()).toBe("updated");
	expect(yield* git("rev-parse", "origin/release/next")).not.toBe(head);
	expect(yield* git("rev-parse", "origin/release/next^")).toBe(yield* git("rev-parse", "origin/main"));
	expect(yield* git("show", "origin/release/next:README.md")).toBe("Conflicting main documentation.");
});

releasePullRequest.it("changed version inputs regenerate the applied release", [], function* ({ pushMain, run, git, readGitHub }) {
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	yield* pushMain("packages/platform/package.json", '{"name":"@shivaedev/platform","version":"0.16.0"}\n');
	expect(yield* run()).toBe("updated");
	expect(yield* git("show", "origin/release/next:packages/platform/package.json")).toContain('"version": "0.16.1"');
	expect((yield* readGitHub()).body).toContain("| @shivaedev/platform | 0.16.0 | 0.16.1 | patch |");
});
