import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { merged } from "#release/test-support/merged.ts";
import { missed } from "#release/test-support/missed.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

releasePullRequest.it("a manifest change without a version bump selects no packages", [missed], function* ({ git, pushMain, preparePush }) {
	const before = yield* git("rev-parse", "HEAD");
	yield* pushMain("packages/platform/package.json", '{"name":"@shivaedev/platform","version":"0.15.0","description":"New description"}\n');

	const release = yield* preparePush(before);

	expect(release).toMatchObject({ packages: [] });
});

releasePullRequest.it(
	"an ordinary push leaves a missing npm version unpublished without release notes",
	[missed],
	function* ({ git, pushMain, publish, publishedPackages, readGitHub }) {
		const before = yield* git("rev-parse", "HEAD");
		yield* pushMain("README.md", "An ordinary documentation change.\n");

		const failure = yield* publish(before);

		expect(failure).toBeUndefined();
		yield* outcomes([
			["published packages", () => publishedPackages(), []],
			["release notes", () => readGitHub().pipe(Effect.map(({ requests }) => requests.filter(({ endpoint }) => endpoint.endsWith("/releases")))), []],
		]);
	},
);

for (const followedByCommit of [false, true]) {
	releasePullRequest.it(
		`a release merge ${followedByCommit ? "followed by another commit" : "at the push head"} publishes exactly the bumped versions with their notes`,
		[missed, merged],
		function* ({ git, pushMain, publish, publishedPackages, readGitHub }) {
			const before = yield* git("rev-parse", "HEAD^");
			if (followedByCommit) {
				yield* pushMain("README.md", "Documentation merged with the release.\n");
			}
			const head = yield* git("rev-parse", "HEAD");

			const failure = yield* publish(before);

			expect(failure).toBeUndefined();
			expect(yield* publishedPackages()).toEqual([
				{ name: "@shivaedev/create-app", version: "0.9.1" },
				{ name: "@shivaedev/platform", version: "0.15.1" },
			]);
			const releases = (yield* readGitHub()).requests.filter(({ endpoint }) => endpoint.endsWith("/releases"));
			expect(releases).toMatchObject([
				{
					body: {
						body: expect.stringContaining("## @shivaedev/platform 0.15.1\n\n### Fixed\n\n- Keep a saved draft."),
						"target_commitish": head,
					},
				},
			]);
			expect(releases[0]?.body?.body).toContain("## @shivaedev/create-app 0.9.1");
			expect(releases[0]?.body?.body).not.toContain("## @shivaedev/react");
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

for (const followedByCommit of [false, true]) {
	releasePullRequest.it(
		`a pushed range ${followedByCommit ? "spanning several commits" : "ending at the release"} selects versions without GitHub linking the PR`,
		[missed, merged],
		function* ({ git, pushMain, preparePush }) {
			const before = yield* git("rev-parse", followedByCommit ? "HEAD~2" : "HEAD^");
			if (followedByCommit) {
				yield* pushMain("README.md", "Documentation after the release.\n");
			}

			const release = yield* preparePush(before);

			expect(release).toMatchObject({
				base: before,
				head: yield* git("rev-parse", "HEAD"),
				packages: [
					{ name: "@shivaedev/create-app", version: "0.9.1" },
					{ name: "@shivaedev/platform", version: "0.15.1" },
				],
			});
		},
	);
}

for (const [title, version, isPrivate] of [
	["a version decrease", "0.14.0", false],
	["a private package version increase", "0.16.0", true],
] as const) {
	releasePullRequest.it(`${title} selects no packages`, [], function* ({ git, pushMain, preparePush }) {
		const before = yield* git("rev-parse", "HEAD");
		yield* pushMain("packages/platform/package.json", JSON.stringify({ name: "@shivaedev/platform", private: isPrivate, version }));

		const release = yield* preparePush(before);

		expect(release.packages).toEqual([]);
	});
}
