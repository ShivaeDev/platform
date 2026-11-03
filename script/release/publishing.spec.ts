import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { merged } from "#release/test-support/merged.ts";
import { missed } from "#release/test-support/missed.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

releasePullRequest.it(
	"an ordinary push leaves a missing npm version unpublished without release notes",
	[missed],
	function* ({ git, publish, publishedPackages, readGitHub }) {
		const failure = yield* publish(yield* git("rev-parse", "HEAD^"));

		expect(failure).toContain("has no merged release/next PR");
		yield* outcomes([
			["published packages", () => publishedPackages(), []],
			["release notes", () => readGitHub().pipe(Effect.map(({ requests }) => requests.filter(({ endpoint }) => endpoint.endsWith("/releases")))), []],
		]);
	},
);

for (const followedByCommit of [false, true]) {
	releasePullRequest.it(
		`a release merge ${followedByCommit ? "followed by another commit" : "at the push head"} publishes current and missed versions with their notes`,
		[missed, merged],
		function* ({ git, pushMain, publish, publishedPackages, readGitHub }) {
			const before = yield* git("rev-parse", "HEAD^");
			if (followedByCommit) {
				yield* pushMain("README.md", "Documentation merged with the release.\n");
			}
			const head = yield* git("rev-parse", "HEAD");

			const failure = yield* publish(before);

			expect(failure).toBeUndefined();
			expect(yield* publishedPackages()).toEqual(
				expect.arrayContaining([
					{ name: "@shivaedev/platform", version: "0.15.1" },
					{ name: "@shivaedev/create-app", version: "0.9.1" },
					{ name: "@shivaedev/react", version: "0.38.0" },
				]),
			);
			const releases = (yield* readGitHub()).requests.filter(({ endpoint }) => endpoint.endsWith("/releases"));
			expect(releases).toMatchObject([
				{
					body: {
						body: expect.stringContaining("## @shivaedev/react 0.38.0\n\n### Fixed\n\n- Keep the editor draft during refresh."),
						"target_commitish": head,
					},
				},
			]);
			expect(releases[0]?.body?.body).toContain("## @shivaedev/platform 0.15.1\n\n### Fixed\n\n- Keep a saved draft.");
			expect(releases[0]?.body?.body).not.toContain("Older react behavior.");
		},
	);
}

for (const allPublished of [false, true]) {
	releasePullRequest.it(
		allPublished
			? "a release already on npm publishes nothing and writes no notes"
			: "versions already on npm are skipped in publishing and release notes",
		[missed, merged],
		function* ({ git, alreadyPublished, publish, publishedPackages, readGitHub }) {
			yield* alreadyPublished("@shivaedev/platform", "0.15.1");
			yield* alreadyPublished("@shivaedev/react", "0.38.0");
			if (allPublished) {
				yield* alreadyPublished("@shivaedev/create-app", "0.9.1");
			}

			const failure = yield* publish(yield* git("rev-parse", "HEAD^"));

			expect(failure).toBeUndefined();
			expect(yield* publishedPackages()).toEqual(allPublished ? [] : [{ name: "@shivaedev/create-app", version: "0.9.1" }]);
			const releases = (yield* readGitHub()).requests.filter(({ endpoint }) => endpoint.endsWith("/releases"));
			if (allPublished) {
				expect(releases).toEqual([]);
			} else {
				expect(releases).toMatchObject([{ body: { body: expect.stringContaining("## @shivaedev/create-app 0.9.1") } }]);
				expect(releases[0]?.body?.body).not.toContain("## @shivaedev/platform");
				expect(releases[0]?.body?.body).not.toContain("## @shivaedev/react");
			}
		},
	);
}

for (const [title, branch, isMerged, matchingCommit] of [
	["an ordinary merged PR cannot publish a release", "feature/next", true, true],
	["an unmerged release PR cannot publish", "release/next", false, true],
	["a release merged outside the push cannot publish", "release/next", true, false],
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

		expect(failure).toContain("has no merged release/next PR");
		expect(yield* publishedPackages()).toEqual([]);
	});
}
