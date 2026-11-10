import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { awaitingPublication, effectPackages } from "#release/test-support/effectPackages.ts";
import { exactPeerCatalog, exactPeerPackages } from "#release/test-support/exactPeerPackages.ts";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

releasePullRequest.it(
	"an Effect catalog bump without a changeset produces a stable release of every drifted public requirement and the starter",
	[effectPackages],
	function* ({ pushMain, run, git, readGitHub, check }) {
		expect(yield* run()).toBe("empty");
		yield* pushMain(
			"pnpm-workspace.yaml",
			'packages:\n  - packages/*\ncatalog:\n  effect: 4.1.1\n  "@effect/platform-node": 4.1.1\n  "@effect/vitest": 4.1.1\n  "@effect/atom-react": 4.1.1\n',
		);

		yield* run();

		yield* outcomes([
			[
				"validated releases",
				() => check().pipe(Effect.map((plan) => plan.releases.map(({ name, bump }) => [name, bump]))),
				[
					["@shivaedev/create-app", "patch"],
					["@shivaedev/form", "patch"],
					["@shivaedev/platform", "patch"],
					["@shivaedev/runtime", "patch"],
					["@shivaedev/testing", "patch"],
				],
			],
			["release PR", () => readGitHub(), { body: expect.stringContaining("| @shivaedev/form | 0.1.0 | 0.1.1 | patch |") }],
			[
				"framework release notes",
				() => git("show", "origin/release/next:packages/form/CHANGELOG.md"),
				expect.stringContaining("### Changed\n\n- Align published dependency requirements with the workspace."),
			],
			[
				"starter pins",
				() => git("show", "origin/release/next:examples/starter/published-versions.json"),
				expect.stringContaining('"@shivaedev/platform": "0.15.1"'),
			],
		]);

		expect(yield* run()).toBe("unchanged");
	},
);

releasePullRequest.it(
	"a main release awaiting npm publication does not create another release PR",
	[effectPackages, awaitingPublication],
	function* ({ run, readGitHub }) {
		yield* run();

		expect((yield* readGitHub()).created).toBe(0);
	},
);

releasePullRequest.it(
	"a catalog update of exact vitest and better-auth peers releases each package that declares them and leaves the others alone",
	[exactPeerPackages],
	function* ({ pushMain, run, check }) {
		yield* pushMain("pnpm-workspace.yaml", exactPeerCatalog("5.1.0", "1.7.15"));

		yield* run();

		expect(yield* check().pipe(Effect.map((plan) => plan.releases.map(({ name, bump }) => [name, bump])))).toEqual([
			["@shivaedev/identity", "patch"],
			["@shivaedev/test-story", "patch"],
		]);
	},
);
