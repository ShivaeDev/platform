import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { biomeReport } from "#biome/report.ts";
import { services } from "#cli/runMain.ts";
import { removeSeededTrees, seedTree } from "./tree.ts";

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
		failure: () => Effect.sync(() => engine.failure),
		requestsReportForUnknownCommand: Effect.fn("BiomeReports.requestsReportForUnknownCommand")(function* () {
			story.tell("quality asks Biome for a report of a command Biome does not know");
			const failure = yield* biomeReport(engine.root, ["unknown-command"]).pipe(Effect.flip);
			engine.failure = failure.message;
		}),
	}),
});
