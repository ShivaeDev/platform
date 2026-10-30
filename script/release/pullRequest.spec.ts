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
		expect(yield* run()).toBe("updated");
		expect(yield* git("rev-parse", "origin/release/next^", "origin/main")).toBe(`${main}\n${main}`);
		expect(yield* git("show", "origin/release/next:packages/platform/package.json")).toContain('"version": "0.15.1"');
		expect(yield* git("show", "origin/release/next:packages/create-app/package.json")).toContain('"version": "0.9.1"');
		expect(yield* git("show", "origin/release/next:examples/starter/published-versions.json")).toContain('"@shivaedev/platform": "0.15.1"');
		expect(yield* git("ls-tree", "--name-only", "origin/release/next:.changeset")).not.toContain("draft.md");
		yield* check();
		const received = yield* readGitHub();
		expect(received.open).toBe(true);
		expect(received.title).toContain("0.9.1");
		expect(received.body).toContain("| @shivaedev/platform | 0.15.0 | 0.15.1 | patch |");
		expect(received.body).toContain("- Keep a saved draft.");
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
		expect(yield* git("rev-parse", "origin/release/next")).not.toBe(previous);
		expect(yield* git("rev-parse", "origin/release/next^")).toBe(yield* git("rev-parse", "origin/main"));
		expect(yield* git("show", "origin/release/next:packages/platform/package.json")).toContain('"version": "0.15.1"');
		yield* check();
		const received = yield* readGitHub();
		expect(received.requests.filter((request) => request.method === "POST" && request.endpoint.endsWith("/pulls"))).toMatchObject([
			{ body: { base: "main", head: "release/next" } },
		]);
		expect(received.title).toContain("0.10.0");
		expect(received.body).toContain("- Keep a saved draft.");
		expect(received.body).toContain("- Choose an app name.");
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
		expect(yield* run()).toBe("held: merge queue");
		expect(yield* git("rev-parse", "origin/release/next")).toBe(head);
		const after = yield* readGitHub();
		expect(after.body).toBe(before.body);
		expect(after.requests.slice(before.requests.length).map((request) => request.endpoint)).toEqual(["graphql"]);
	},
);

releasePullRequest.it("merging a release leaves no pending plan and closes a stale open PR", [], function* ({ pushMain, run, git, readGitHub }) {
	expect(yield* run()).toBe("empty");
	expect((yield* readGitHub()).created).toBe(0);
	yield* pushMain(".changeset/draft.md", PENDING);
	yield* run();
	const head = yield* git("rev-parse", "origin/release/next");
	yield* git("switch", "main");
	yield* git("merge", "--ff-only", "release/next");
	yield* git("push", "origin", "main");
	expect(yield* run()).toBe("empty");
	expect(yield* git("rev-parse", "origin/release/next")).toBe(head);
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
			yield* outcomes({
				"pull request writes": [readGitHub().pipe(Effect.map(({ requests }) => requests)), []],
				"release failure": [Effect.succeed(failure), tag],
			});
		},
	);
}
