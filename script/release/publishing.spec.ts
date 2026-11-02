import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { merged } from "#release/test-support/merged.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

releasePullRequest.it("a main push without a merged release PR publishes nothing", [], function* ({ git, publish, publishedPackages, readGitHub }) {
	const failure = yield* publish(yield* git("rev-parse", "origin/main"));
	expect(failure).toContain("is not a merged release/next PR");
	yield* outcomes([
		["published packages", () => publishedPackages(), []],
		[
			"release notes written",
			() => readGitHub().pipe(Effect.map(({ requests }) => requests.some(({ endpoint }) => endpoint.endsWith("/releases")))),
			false,
		],
	]);
});

for (const [title, branch, isMerged, matchingCommit] of [
	["an ordinary merged PR cannot publish a release", "feature/next", true, true],
	["an unmerged release PR cannot publish", "release/next", false, true],
	["a release merged at another main commit cannot publish", "release/next", true, false],
] as const) {
	releasePullRequest.it(title, [merged], function* ({ git, publish, replyToMergedPulls, publishedPackages }) {
		const commit = yield* git("rev-parse", "HEAD");
		const before = yield* git("rev-parse", "HEAD^");
		yield* replyToMergedPulls([
			{
				base: { ref: "main", repo: { "full_name": "example/workspace" } },
				head: { ref: branch, repo: { "full_name": "example/workspace" }, sha: commit },
				"merge_commit_sha": matchingCommit ? commit : before,
				"merged_at": isMerged ? "2026-11-02T00:00:00Z" : null,
				number: 2,
			},
		]);
		const failure = yield* publish(before);
		expect(failure).toContain("is not a merged release/next PR");
		expect(yield* publishedPackages()).toEqual([]);
	});
}

releasePullRequest.it("an unavailable PR head stops before publishing", [merged], function* ({ git, publish, publishedPackages }) {
	yield* git("push", "origin", ":refs/pull/1/head");
	const failure = yield* publish(yield* git("rev-parse", "HEAD^"));
	expect(failure).toContain("cannot fetch release PR head refs/pull/1/head");
	expect(yield* publishedPackages()).toEqual([]);
});

releasePullRequest.it("a moved PR ref cannot substitute for the merged PR head", [merged], function* ({ git, publish, publishedPackages }) {
	yield* git("push", "--force", "origin", "HEAD:refs/pull/1/head");
	const failure = yield* publish(yield* git("rev-parse", "HEAD^"));
	expect(failure).toContain("expected merged PR head");
	expect(yield* publishedPackages()).toEqual([]);
});

releasePullRequest.it(
	"versions recorded by main must agree before any package is published",
	[merged],
	function* ({ git, publish, publishedPackages, replyToMergedPulls }) {
		yield* git("fetch", "origin", "refs/pull/1/head");
		yield* git("switch", "--detach", "FETCH_HEAD");
		yield* git("restore", "--source=main^", "packages/platform/package.json");
		yield* git("commit", "-am", "Different frozen package version");
		const head = yield* git("rev-parse", "HEAD");
		yield* git("push", "--force", "origin", `${head}:refs/pull/1/head`);
		yield* git("switch", "main");
		const commit = yield* git("rev-parse", "HEAD");
		yield* replyToMergedPulls([
			{
				base: { ref: "main", repo: { "full_name": "example/workspace" } },
				head: { ref: "release/next", repo: { "full_name": "example/workspace" }, sha: head },
				"merge_commit_sha": commit,
				"merged_at": "2026-11-02T00:00:00Z",
				number: 1,
			},
		]);
		const failure = yield* publish(yield* git("rev-parse", "HEAD^"));
		expect(failure).toContain("@shivaedev/platform at release head is 0.15.0, but merged main records 0.15.1");
		expect(yield* publishedPackages()).toEqual([]);
	},
);
