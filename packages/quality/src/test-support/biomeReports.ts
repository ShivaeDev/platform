import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { biomeReport } from "#biome/report.ts";
import { services } from "#cli/runMain.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

export const biomeReports = storyKit({
	clock: "live",
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		return { failure: "", root: seedTree([]) };
	},
	layer: services,
	name: "Biome reports",
	stages: [],
	verbs: (engine, story) => ({
		failure: () => engine.failure,
		runUnsupportedCommand: Effect.fn("BiomeReports.runUnsupportedCommand")(function* () {
			story.tell("the author requests a Biome report with an unsupported command");
			const failure = yield* biomeReport(engine.root, ["unknown-command"]).pipe(Effect.flip);
			engine.failure = failure.message;
		}),
	}),
});
