import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

const PENDING = '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n';

releasePullRequest.it(
	"a main push publishes an applied release branch and a PR ready for CI approval",
	[],
	function* ({ pushMain, run, git, readGitHub, check }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		const main = yield* git("rev-parse", "origin/main");
		yield* outcomes([
			["run", () => run(), "updated"],
			["release parent and main", () => git("rev-parse", "origin/release/next^", "origin/main"), `${main}\n${main}`],
			["platform manifest", () => git("show", "origin/release/next:packages/platform/package.json"), expect.stringContaining('"version": "0.15.1"')],
			[
				"create-app manifest",
				() => git("show", "origin/release/next:packages/create-app/package.json"),
				expect.stringContaining('"version": "0.9.1"'),
			],
			[
				"starter pins",
				() => git("show", "origin/release/next:examples/starter/published-versions.json"),
				expect.stringContaining('"@shivaedev/platform": "0.15.1"'),
			],
			["changesets on the release", () => git("ls-tree", "--name-only", "origin/release/next:.changeset"), expect.not.stringContaining("draft.md")],
		]);
		yield* check();
		const received = yield* readGitHub();
		expect(received.open).toBe(true);
		expect(received.title).toContain("0.9.1");
		expect(received.body).toContain("| @shivaedev/platform | 0.15.0 | 0.15.1 | patch |");
		expect(received.body).not.toContain("- Keep a saved draft.");
		expect(received.body).toContain("Allow GitHub Actions to create pull requests");
		expect(received.body).toContain("press **Approve and run**, then merge when full CI is green");
		expect(received.requests.filter((request) => request.endpoint === "graphql")).toMatchObject([
			{ body: { query: expect.stringContaining("pullRequests") }, method: "POST" },
		]);
	},
);

releasePullRequest.it(
	"later main pushes regenerate a PR waiting for approval with the latest plan",
	[],
	function* ({ pushMain, run, git, readGitHub, check, setCiRun }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* setCiRun("completed", "action_required");
		const previous = yield* git("rev-parse", "origin/release/next");
		yield* pushMain(".changeset/another.md", '---\n"@shivaedev/create-app": minor\n---\n\n### Added\n\n- Choose an app name.\n');
		yield* run();
		const main = yield* git("rev-parse", "origin/main");
		yield* outcomes([
			["release head", () => git("rev-parse", "origin/release/next"), expect.not.stringContaining(previous)],
			["release parent", () => git("rev-parse", "origin/release/next^"), main],
			["platform manifest", () => git("show", "origin/release/next:packages/platform/package.json"), expect.stringContaining('"version": "0.15.1"')],
		]);
		yield* check();
		const received = yield* readGitHub();
		expect(received.requests.filter((request) => request.method === "POST" && request.endpoint.endsWith("/pulls"))).toMatchObject([
			{ body: { base: "main", head: "release/next" } },
		]);
		expect(received.title).toContain("0.10.0");
		expect(received.body).toContain("| @shivaedev/platform | 0.15.0 | 0.15.1 | patch |");
		expect(received.body).toContain("| @shivaedev/create-app | 0.9.0 | 0.10.0 | minor |");
	},
);

releasePullRequest.it(
	"queued release PRs retain their branch and metadata even with new pending changes",
	[],
	function* ({ pushMain, run, git, queue, readGitHub }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* queue();
		const before = yield* readGitHub();
		const head = yield* git("rev-parse", "origin/release/next");
		yield* pushMain(".changeset/next.md", PENDING);
		yield* outcomes([
			["run", () => run(), "held: merge queue"],
			["release head", () => git("rev-parse", "origin/release/next"), head],
		]);
		const after = yield* readGitHub();
		expect(after.body).toBe(before.body);
		expect(after.requests.slice(before.requests.length).map((request) => request.endpoint)).toEqual(["graphql"]);
	},
);

releasePullRequest.it("merging a release leaves no pending plan and closes a stale open PR", [], function* ({ pushMain, run, git, readGitHub }) {
	yield* outcomes([
		["run", () => run(), "empty"],
		["created pull requests", () => Effect.map(readGitHub(), (github) => github.created), 0],
	]);
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	const head = yield* git("rev-parse", "origin/release/next");
	yield* git("switch", "main");
	yield* git("merge", "--ff-only", "release/next");
	yield* git("push", "origin", "main");
	yield* outcomes([
		["run", () => run(), "empty"],
		["release head", () => git("rev-parse", "origin/release/next"), head],
	]);
	const received = yield* readGitHub();
	expect(received.open).toBe(false);
});

for (const [body, status, tag] of [
	[{ message: "unavailable" }, HttpStatus.fromLiteral("ServiceUnavailable"), "RemoteHttpError"],
	[{ data: { repository: null } }, HttpStatus.fromLiteral("OK"), "SchemaError"],
] as const) {
	releasePullRequest.it(
		`keeps ${tag} visible instead of treating an unreadable snapshot as an empty release`,
		[],
		function* ({ replyToSnapshot, failedRun, readGitHub }) {
			yield* replyToSnapshot(body, status);
			const failure = yield* failedRun();
			yield* outcomes([
				["pull request writes", () => readGitHub().pipe(Effect.map(({ requests }) => requests)), []],
				["release failure", () => Effect.succeed(failure), tag],
			]);
		},
	);
}

releasePullRequest.it("a failed branch switch reaches the caller as a typed GitError", [], function* ({ git, failedRun }) {
	yield* git("update-ref", "-d", "refs/remotes/origin/main");

	const failure = yield* failedRun();

	expect(failure).toBe("GitError");
});

releasePullRequest.it("a failed standing release lookup reaches the caller as a typed GitError", [], function* ({ failedComparison }) {
	const failure = yield* failedComparison("missing-release");

	expect(failure).toBe("GitError");
});

releasePullRequest.it("an undated standing changelog reaches the caller as a typed ChangesetError", [], function* ({ pushMain, failedComparison }) {
	yield* pushMain("packages/platform/CHANGELOG.md", "# Changelog\n\n## Undated release\n");

	const failure = yield* failedComparison("HEAD");

	expect(failure).toBe("ChangesetError");
});

releasePullRequest.it(
	"a release waiting in Git can be interrupted before it publishes",
	[],
	function* ({ pushMain, blockCommit, startRun, waitForCommit, readGitHub }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* blockCommit();
		const running = yield* startRun();
		yield* waitForCommit();

		yield* running.interrupt();

		yield* outcomes([
			["release result", () => running.result(), "interrupted"],
			["pull requests created", () => readGitHub(), { created: 0 }],
		]);
	},
);
