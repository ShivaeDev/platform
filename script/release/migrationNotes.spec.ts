import { expect } from "vitest";
import { migrationPlan, patchPlan } from "#release/test-support/migrations.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

const MIGRATIONS = `## Migration checklist

### @shivaedev/create-app

- Replace \`create --name\` → \`create <name>\`.

### @shivaedev/platform

- Replace \`oldQuery\` → \`query\`.
  Pass the contract as the first argument.
- Replace \`oldAction\` → \`command\`.

### @shivaedev/quality

- Replace \`quality.config.js\` → \`quality.config.ts\`.

### Quality rules

- \`imports/aliased\`: require aliases across folders. Record existing findings with \`quality baseline write --rule imports/aliased\`; fix them by replacing cross-folder relative imports with aliases.`;

for (const { description, trait, expected, starterNotes } of [
	{
		description: "three packages' breaking entries followed by a new quality rule's adoption steps",
		expected: MIGRATIONS,
		starterNotes: "## @shivaedev/create-app 0.10.0\n\n### Breaking\n\n- Replace `create --name` → `create <name>`.",
		trait: migrationPlan,
	},
	{
		description: "one line saying there are no breaking changes or new or stricter quality rules",
		expected: "No breaking changes or new or stricter quality rules in this release.",
		starterNotes: "## @shivaedev/create-app 0.9.1\n\n### Changed\n\n- Generated apps use the latest released starter dependencies.",
		trait: patchPlan,
	},
]) {
	releasePullRequest.it(`the release PR leads with ${description}`, [trait], function* ({ run, readGitHub }) {
		yield* run();

		expect((yield* readGitHub()).body.split("\n\n### Why?")[0]).toBe(expected);
	});

	releasePullRequest.it(
		`the GitHub release leads with ${description} and includes create-app's applied notes after a squash merge`,
		[trait],
		function* ({ run, git, publishNotes, readGitHub }) {
			const base = yield* git("rev-parse", "origin/main");
			yield* run();
			yield* git("switch", "main");
			yield* git("merge", "--squash", "release/next");
			yield* git("commit", "-m", "Release packages");
			const head = yield* git("rev-parse", "HEAD");

			yield* publishNotes(base);

			const requests = (yield* readGitHub()).requests.filter((request) => request.endpoint.endsWith("/releases"));
			expect(requests).toMatchObject([
				{
					body: {
						body: expect.stringMatching(`^${RegExp.escape(expected)}\n\n## @shivaedev/`),
						"tag_name": `release-${head}`,
						"target_commitish": head,
					},
					method: "POST",
				},
			]);
			expect(requests[0]?.body?.body).toContain(starterNotes);
		},
	);
}
