import { NodeServices } from "@effect/platform-node";
import { Context, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { Fleet } from "#fleet.ts";
import { createEngine } from "#test/createEngine.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { engineVerbs } from "#test/engineVerbs.ts";
import { hasPostgres, postgresLayer } from "#test/postgres.ts";
import { createFleetBoard } from "#test/withFleetBoard.ts";

function makeEngineStory(isolated: boolean) {
	const definition = {
		after: {
			*configuration(state: EngineStory) {
				const board = state.markdown ? yield* createFleetBoard(state.options) : undefined;
				state.root = board?.root ?? "";
				state.source = board?.source ?? "";
				const runtime = yield* createEngine(state.options, board?.board);
				const services = yield* Layer.build(runtime.layer);
				state.runtime = { ...runtime, fleet: Context.get(services, Fleet) };
			},
		},
		create: (): EngineStory => ({ markdown: false, options: {}, root: "", source: "", workId: "one" }),
		inspect: (state: EngineStory) => ({
			provider:
				state.runtime === undefined
					? undefined
					: {
							calls: state.runtime.fixture.settings,
							observations: [...state.runtime.fixture.observations.values()],
							starts: state.runtime.fixture.starts,
						},
			record: state.lastRecord,
		}),
		layer: Layer.merge(postgresLayer, NodeServices.layer),
		name: "fleet engine",
		run: {
			diagnose: (state: EngineStory) => `${state.workId} is ${state.lastRecord?.stage ?? "not observed"}`,
			maxSteps: 20,
			*step(state: EngineStory, tell: (line: string) => void) {
				const record = yield* running(state).fleet.reconcile(state.workId);
				state.lastRecord = record.value;
				tell(`reconcile ${state.workId}: ${record.value.stage}`);
			},
		},
		runIf: hasPostgres,
		stages: ["integrations", "configuration", "work"] as const,
		verbs: engineVerbs,
	};
	return isolated ? storyKit({ ...definition, around: withIsolatedDatabase }) : storyKit({ ...definition, around: withTestTransaction });
}

export const engine = makeEngineStory(false);
export const isolatedEngine = makeEngineStory(true);
