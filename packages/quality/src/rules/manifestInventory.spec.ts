import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { manifestIsDirectory, manifestStory, repositoryHas } from "#test/manifestStory.ts";

const BROKEN = "packages/broken/package.json";

for (const content of ['{"name":', '{"dependencies":[]}', '{"bin":[]}']) {
	manifestStory.it(
		`quality lint reports the broken manifest ${content} in one line under manifests/valid, without an error`,
		[repositoryHas({ content, path: BROKEN })],
		function* ({ reportLines, outcome, runs, stderr, stdout }) {
			yield* runs("lint");

			yield* outcomes({
				"error output": [stderr(), ""],
				"exit": [outcome(), "rejected"],
				"lines naming the manifest": [reportLines(BROKEN), [expect.stringContaining("Invalid package manifest")]],
				"rule": [stdout(), expect.stringContaining("manifests/valid")],
			});
		},
		CLI_TIMEOUT,
	);
}

manifestStory.it(
	"quality lint stops with an error that names an unreadable package.json",
	[manifestIsDirectory],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes({
			"error": [stderr(), expect.stringMatching(/cannot read.*package\.json/u)],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

manifestStory.it(
	"quality fix stops with an error that names a manifest it cannot decode",
	[repositoryHas({ content: '{"name":', path: BROKEN })],
	function* ({ outcome, runs, stderr }) {
		yield* runs("fix");

		yield* outcomes({
			"error": [stderr(), expect.stringMatching(/packages\/broken\/package\.json.*Invalid package manifest/u)],
			"exit": [outcome(), "invalid"],
		});
	},
	CLI_TIMEOUT,
);

manifestStory.it(
	"two rules that read package.json at once, one as ./package.json, share one file read and one decoded manifest",
	[repositoryHas({ content: '{"name":"app"}', path: "package.json" })],
	function* ({ decodedManifests, fileReads, sharedManifest, twoRulesReadAtOnce }) {
		yield* twoRulesReadAtOnce("package.json");

		yield* outcomes({
			"decoded manifests": [decodedManifests(), [{ name: "app" }, { name: "app" }]],
			"file reads": [fileReads(), ["package.json"]],
			"one shared manifest": [sharedManifest(), true],
		});
	},
	CLI_TIMEOUT,
);
