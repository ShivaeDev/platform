import * as NodeServices from "@effect/platform-node/NodeServices";
import { Context, Effect, FileSystem, Layer, Option } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Fleet } from "#fleet.ts";
import { createEngine } from "#test/createEngine.ts";
import { type FleetStoryState, fleetStoryState } from "#test/fleetStoryState.ts";
import { fleetVerbs } from "#test/fleetVerbs.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

export const fleetStory = storyKit({
	after: {
		*configuration(engine: FleetStoryState) {
			const { fixture, fleetLayer } = yield* createEngine(engine.options, Option.getOrUndefined(engine.board));
			const fleet = Context.get(yield* Layer.build(fleetLayer), Fleet);
			engine.runtime = Option.some({ fixture, fleet, fleetLayer });
		},
	},
	around: withIsolatedDatabase,
	*create() {
		return fleetStoryState(yield* Effect.service(FileSystem.FileSystem).pipe(Effect.provide(NodeServices.layer)));
	},
	inspect: (engine) => ({ commits: engine.commits }),
	layer: postgresLayer,
	name: "fleet",
	runIf: postgresEnabled,
	stages: ["configuration", "board"],
	verbs: fleetVerbs,
});

export const sharedArea = fleetStory.trait("board", "approved work shares an area in preparation order", (engine) => {
	const { fixture } = Option.getOrThrow(engine.runtime);
	for (const id of ["one", "two", "three"]) {
		fixture.approveWork(id, `board-${id}`);
		fixture.areas(id, ["shared"]);
	}
	fixture.approveWork("dependency", "board-dependency");
});

export const highPrioritySecond = fleetStory.trait("board", "the second item has high dispatch priority", (engine) => {
	const { fixture } = Option.getOrThrow(engine.runtime);
	fixture.priority("two", "high");
});

export const githubBacklog = fleetStory.trait("configuration", "GitHub PRs share a two-slot open-PR backlog", function* (engine) {
	const github = yield* mergedReviewGithub();
	engine.github = Option.some(github);
	engine.options = { ...github, backlog: 2 };
});

export const singlePrBacklog = fleetStory.trait("configuration", "the delivery backlog only admits one PR at a time", (engine) => {
	engine.options = { ...engine.options, backlog: 1 };
});

export const immediateAreaRelease = fleetStory.trait("configuration", "reviewed PRs release their areas without a merge wait", (engine) => {
	engine.options = { ...engine.options, areaMergeWaitMs: 0 };
});
