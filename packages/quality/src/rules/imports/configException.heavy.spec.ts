import { fenceExceptions, importFenceRepository } from "#test/importFenceRepository.ts";
import { installedWorkspace } from "#test/installedWorkspace.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const REASON = "The play screen previews CMS drafts until the preview service lands.";

const PLAY_EXCEPTION = { files: ["packages/game/src/play.ts"], reason: REASON, rules: ["imports/fences"], subject: "game-keeps-out-of-cms" };

const FENCED = [qualityInstalled(), repositoryHas(...importFenceRepository), installedWorkspace("@demo/cms", "packages/cms"), biomeFormatted()];

repositoryStory.it(
	"quality lint passes once a config exception covers the one import across a fence",
	FENCED,
	function* ({ runs, spawns, writes }) {
		yield* assertThat((yield* runs("lint")).stdout, (actual) =>
			actual.toContain('packages/game/src/play.ts:1  Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms"'),
		);

		yield* writes(fenceExceptions([PLAY_EXCEPTION]));
		yield* spawns("fix");

		yield* assertThat((yield* spawns("lint")).outcome, (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);
