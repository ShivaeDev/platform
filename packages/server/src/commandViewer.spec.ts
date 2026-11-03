import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notes } from "#test/command-changes/fixture.ts";
import { commandChanges } from "#test/command-changes/story.ts";

for (const auth of ["required", "optional", "user", "accounts"] as const) {
	commandChanges.it(
		`the ${auth}-auth command computes invalidation once for alice and publishes her changes once to both hosts`,
		[],
		function* ({ invalidationViewers, nextHint, publishedChanges, saveAs }) {
			yield* saveAs(auth);

			yield* outcomes([
				["invalidation callback viewers", () => invalidationViewers(), ["alice"]],
				["published changes", () => publishedChanges(), [["command_notes:1", "command_notes"]]],
				["local hint", () => nextHint("local"), { _tag: "Changed", keys: [notes.item(1)] }],
				["remote hint", () => nextHint("remote"), { _tag: "Changed", keys: [notes.item(1)] }],
			]);
		},
	);
}

commandChanges.it(
	"an anonymous optional-auth command computes invalidation once and publishes its changes once",
	[],
	function* ({ invalidationViewers, nextHint, publishedChanges, saveAs }) {
		yield* saveAs("optional", "anonymous");

		yield* outcomes([
			["invalidation callback viewers", () => invalidationViewers(), ["anonymous"]],
			["published changes", () => publishedChanges(), [["command_notes:1", "command_notes"]]],
			["remote hint", () => nextHint("remote"), { _tag: "Changed", keys: [notes.item(1)] }],
		]);
	},
);
