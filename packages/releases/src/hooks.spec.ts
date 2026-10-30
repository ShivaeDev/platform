import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CORE } from "#test/fixture.ts";
import { hookFails, hookFromSiblingModule, hooksRecordingCore, pending } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

workspace.it(
	"apply runs a hook imported from a sibling module of the config with the release plan",
	[pending(), hookFromSiblingModule],
	function* ({ apply, hookRecord }) {
		yield* apply();

		expect(yield* hookRecord()).toEqual([
			"planned @test/api 0.5.1",
			`planned ${CORE} 0.3.0`,
			"planned @test/optional 1.0.1",
			"planned @test/peer 1.0.1",
		]);
	},
);

workspace.it(
	"apply runs its hooks in config order after collection has written the new versions",
	[pending(), hooksRecordingCore(["first", "second"])],
	function* ({ apply, hookRecord }) {
		yield* apply();

		expect(yield* hookRecord()).toEqual([`first saw ${CORE} at 0.3.0`, `second saw ${CORE} at 0.3.0`]);
	},
);

workspace.it(
	"apply reports a failing hook's ChangesetError message after collection has written the release",
	[pending(), hookFails("Repair the repository pins.")],
	function* ({ apply, changesetFiles, lastAnswer, version }) {
		yield* outcomes({
			"changeset files": [changesetFiles(), ["changesets.config.ts", "feature.md"]],
			[`${CORE}'s version`]: [version(CORE), "0.2.3"],
		});

		yield* apply();

		yield* outcomes({
			answer: [lastAnswer(), "refused: Repair the repository pins."],
			"changeset files": [changesetFiles(), ["changesets.config.ts"]],
			[`${CORE}'s version`]: [version(CORE), "0.3.0"],
		});
	},
);
