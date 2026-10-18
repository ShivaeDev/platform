import { Context, Effect, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { createEngine, finishWorkers } from "#test/engine.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

export const areaClaimsStory = storyKit({
	around: withIsolatedDatabase,
	*create() {
		const merged = new Set<string>();
		const logs = captureLogs();
		const { fixture, fleetLayer } = yield* createEngine({
			deliveryQuery: (result) =>
				Effect.succeed(merged.has(result.pr) ? { head: result.head, revision: `merged-${result.head}`, url: result.pr } : undefined),
		});
		const fleet = Context.get(yield* Layer.build(fleetLayer), Fleet);
		return { fixture, fleetLayer, logs, merged, runtime: { fleet } };
	},
	inspect: ({ fixture }) => ({ providerLaunches: fixture.starts.map((start) => start.prompt) }),
	layer: postgresLayer,
	name: "area claims",
	runIf: postgresEnabled,
	stages: ["board"],
	verbs: ({ fixture, fleetLayer, logs, merged, runtime }, story) => ({
		dispatch: (id: string) => {
			story.tell(`Fleet dispatches ${id}`);
			return runtime.fleet.dispatch(id);
		},
		finishWorkers: () => {
			story.tell("the provider reports completed turns");
			finishWorkers(fixture);
		},
		get: (id: string) => runtime.fleet.get(id),
		merge: (id: string) =>
			Effect.gen(function* () {
				story.tell(`a human merges the PR for ${id}`);
				const result = (yield* runtime.fleet.get(id)).value.result;
				if (result?.kind !== "change") {
					return yield* Effect.die(`Missing adopted PR for ${id}`);
				}
				merged.add(result.pr);
			}),
		prepare: (id: string) => {
			story.tell(`Fleet prepares ${id}`);
			return runtime.fleet.prepare({
				cwd: "/synthetic",
				preparation: prepared({ ownedPaths: [`src/${id}.ts`] }),
				prompt: `Implement ${id}`,
				workId: id,
			});
		},
		providerLaunches: () => fixture.starts.map((start) => start.prompt),
		reconcile: (id: string) => {
			story.tell(`Fleet reconciles ${id}`);
			return runtime.fleet.reconcile(id);
		},
		recordedClaimRepairs: () =>
			logs.entries.filter((entry) => Array.isArray(entry.message) && entry.message.includes("Fleet dropped terminal area claim")),
		release: (id: string) =>
			Effect.gen(function* () {
				story.tell(`a human releases ${id}`);
				const decision = (yield* runtime.fleet.get(id)).value.decision;
				if (decision === undefined) {
					return yield* Effect.die(`Missing release decision for ${id}`);
				}
				return yield* runtime.fleet.resolve(id, decision.id, fixture.respond(decision.id, "release"));
			}),
		restart: () =>
			Effect.gen(function* () {
				story.tell("Fleet restarts and runs its first scheduler pass against saved records");
				runtime.fleet = Context.get(yield* Layer.build(Layer.fresh(fleetLayer)), Fleet);
				yield* cycle.pipe(Effect.provideService(Fleet, runtime.fleet));
			}).pipe(Effect.provide(logs.layer)),
		schedule: () => {
			story.tell("Fleet runs a scheduler pass");
			return cycle.pipe(Effect.provideService(Fleet, runtime.fleet), Effect.provide(logs.layer));
		},
	}),
});

export const overlappingAreas = areaClaimsStory.trait("board", "approved items share one of the first item's two areas", ({ fixture }) => {
	fixture.areas("one", ["shared", "other"]);
	fixture.areas("two", ["shared"]);
});
