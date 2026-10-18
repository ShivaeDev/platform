import { Context, Effect, Layer } from "effect";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { createEngine, finishWorkers } from "#test/engine.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

export const fleetStory = storyKit({
	around: withTestTransaction,
	*create() {
		const { fixture, fleetLayer } = yield* createEngine({});
		const fleet = Context.get(yield* Layer.build(fleetLayer), Fleet);
		return { fixture, fleet };
	},
	inspect: ({ fixture }) => ({ launched: fixture.starts.map((start) => start.prompt) }),
	layer: postgresLayer,
	name: "fleet",
	runIf: postgresEnabled,
	stages: ["board"],
	verbs: ({ fixture, fleet }, story) => ({
		attemptDispatch: (id: string) => {
			story.tell(`Fleet attempts to dispatch ${id}`);
			return fleet.dispatch(id).pipe(Effect.flip);
		},
		dependencies: (id: string, targets: readonly string[]) => {
			story.tell(`${id} now depends on ${targets.join(", ") || "no other work"}`);
			fixture.dependencies(id, targets);
		},
		dispatch: (id: string) => {
			story.tell(`Fleet dispatches ${id}`);
			return fleet.dispatch(id);
		},
		finishWorkers: () => {
			story.tell("the provider reports that the active turns completed");
			finishWorkers(fixture);
		},
		get: fleet.get,
		prepare: (id: string) => {
			story.tell(`Fleet prepares ${id}`);
			return fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: [`src/${id}.ts`] }), prompt: `Implement ${id}`, workId: id });
		},
		reconcile: (id: string) => {
			story.tell(`Fleet reconciles ${id}`);
			return fleet.reconcile(id);
		},
		schedule: () => {
			story.tell("Fleet runs a scheduler pass");
			return cycle.pipe(Effect.provideService(Fleet, fleet));
		},
		unavailableWork: (id: string, unavailable: boolean) => {
			story.tell(`Board reads for ${id} are ${unavailable ? "unavailable" : "available"}`);
			fixture.unavailableWork(id, unavailable);
		},
	}),
});

export const sharedArea = fleetStory.trait("board", "approved work shares an area in preparation order", ({ fixture }) => {
	for (const id of ["one", "two", "three"]) {
		fixture.approveWork(id, `board-${id}`);
		fixture.areas(id, ["shared"]);
	}
	fixture.approveWork("dependency", "board-dependency");
});

export const highPrioritySecond = fleetStory.trait("board", "the second item has high dispatch priority", ({ fixture }) => {
	fixture.priority("two", "high");
});
