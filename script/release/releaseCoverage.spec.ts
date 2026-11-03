import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { collectedBehindMain } from "#release/test-support/collectedBehindMain.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";
import { repository } from "#release/test-support/repository.ts";

repository.it(
	"the publishing gate refuses changesets merged after the collected release and names their commit",
	[collectedBehindMain],
	function* ({ check }) {
		const answer = yield* check();

		expect(answer).toContain("Release leaves pending changesets outside its notes: later.md.");
		expect(answer).toMatch(/[a-f\d]+ Replace platform API/u);
		expect(answer).toContain("Let the release PR regenerate before merging or publishing.");
	},
);

const PENDING = '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n';
const LATER =
	'---\n"@shivaedev/create-app": minor\n"@shivaedev/platform": minor\n"@shivaedev/pending": minor\n---\n\n### Added\n\n- `@shivaedev/create-app`: Choose an app name.\n- `@shivaedev/pending`: Choose an app name.\n- `@shivaedev/platform`: Use the later feature.\n';

releasePullRequest.it(
	"a frozen release passes the merge queue and squash publishing gates, leaving later inputs for a new PR",
	[],
	function* ({ pushMain, run, git, setCiRun, check, close, readGitHub, publish, publishedPackages, publishedFile, replyToMergedPulls }) {
		yield* pushMain("packages/platform/index.js", 'export const feature = "frozen";\n');
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* setCiRun("in_progress");
		const head = yield* git("rev-parse", "origin/release/next");
		yield* git("push", "origin", `${head}:refs/pull/1/head`);
		yield* pushMain("packages/platform/index.js", 'export const feature = "later";\n');
		yield* pushMain("packages/pending/package.json", '{"name":"@shivaedev/pending","version":"0.0.0"}\n');
		yield* pushMain(".changeset/later.md", LATER);
		yield* outcomes([
			["maintainer", () => run(), "held: approved CI in_progress"],
			["frozen head", () => git("rev-parse", "origin/release/next"), head],
		]);
		const base = yield* git("rev-parse", "origin/main");
		yield* git("switch", "-c", "merge-group", base);
		yield* git("merge", "--no-ff", "--no-edit", "origin/release/next");

		const queued = yield* check(base);
		expect(queued.changesets.map(({ name }) => name)).toEqual(["draft.md", "release-starter-pins.md"]);
		expect(queued.releases.map(({ name, to }) => [name, to])).toEqual([
			["@shivaedev/create-app", "0.9.1"],
			["@shivaedev/platform", "0.15.1"],
		]);
		expect(yield* git("show", "HEAD:.changeset/later.md")).toBe(LATER.trim());
		yield* git("switch", "main");
		yield* git("merge", "--squash", "origin/release/next");
		yield* git("commit", "-m", "Release approved versions");

		expect((yield* check(base)).releases).toEqual(queued.releases);
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
		const failure = yield* publish(base);
		expect(failure).toBeUndefined();
		yield* outcomes([
			["published head", () => git("rev-parse", "HEAD"), head],
			["published code", () => publishedFile("@shivaedev/platform", "index.js"), 'export const feature = "frozen";\n'],
			[
				"published versions",
				() => publishedPackages().pipe(Effect.map((packages) => packages.toSorted((left, right) => left.name.localeCompare(right.name)))),
				[
					{ name: "@shivaedev/create-app", version: "0.9.1" },
					{ name: "@shivaedev/platform", version: "0.15.1" },
				],
			],
		]);
		const published = (yield* readGitHub()).requests.find(({ endpoint }) => endpoint.endsWith("/releases"));
		expect(published?.body).toMatchObject({ "tag_name": `release-${head}`, "target_commitish": head });
		expect(published?.body?.body).toContain("Keep a saved draft.");
		expect(published?.body?.body).not.toContain("Choose an app name.");
		yield* git("switch", "main");
		yield* git("push", "origin", "main");
		yield* close();

		expect(yield* run()).toBe("updated");
		const next = yield* check();
		expect(next.changesets).toEqual([{ name: "later.md", text: LATER }]);
		expect(next.releases.map(({ name, to }) => [name, to])).toEqual([
			["@shivaedev/create-app", "0.10.0"],
			["@shivaedev/pending", "0.1.0"],
			["@shivaedev/platform", "0.16.0"],
		]);
		const pull = yield* readGitHub();
		expect(pull.requests.filter(({ method, endpoint }) => method === "POST" && endpoint.endsWith("/pulls")).map(({ body }) => body?.title)).toEqual([
			expect.stringContaining("0.9.1"),
			expect.stringContaining("0.10.0"),
		]);
		expect(pull.open).toBe(true);
		expect(yield* git("show", "origin/release/next:packages/create-app/CHANGELOG.md")).toContain("Choose an app name.");
	},
);
