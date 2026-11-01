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
const LATER = '---\n"@shivaedev/create-app": minor\n---\n\n### Added\n\n- Choose an app name.\n';

releasePullRequest.it(
	"a frozen release passes the merge queue and squash publishing gates, leaving later inputs for a new PR",
	[],
	function* ({ pushMain, run, git, setCiRun, check, close, readGitHub, publishNotes }) {
		yield* pushMain(".changeset/draft.md", PENDING);
		yield* run();
		yield* setCiRun("in_progress");
		const head = yield* git("rev-parse", "origin/release/next");
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
		yield* publishNotes(base);
		const published = (yield* readGitHub()).requests.find(({ endpoint }) => endpoint.endsWith("/releases"));
		expect(published?.body?.body).toContain("Keep a saved draft.");
		expect(published?.body?.body).not.toContain("Choose an app name.");
		yield* git("push", "origin", "main");
		yield* close();

		expect(yield* run()).toBe("updated");
		const next = yield* check();
		expect(next.changesets).toEqual([{ name: "later.md", text: LATER }]);
		expect(next.releases.map(({ name, to }) => [name, to])).toEqual([["@shivaedev/create-app", "0.10.0"]]);
		const pull = yield* readGitHub();
		expect(pull.requests.filter(({ method, endpoint }) => method === "POST" && endpoint.endsWith("/pulls")).map(({ body }) => body?.title)).toEqual([
			expect.stringContaining("0.9.1"),
			expect.stringContaining("0.10.0"),
		]);
		expect(pull.open).toBe(true);
		expect(pull.body).toContain("Choose an app name.");
		expect(pull.body).not.toContain("Keep a saved draft.");
	},
);
