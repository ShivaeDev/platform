import { Deferred, Effect, Tracer } from "effect";
import { Fleet } from "#fleet.ts";
import { answerWork } from "#host/answerWork.ts";
import { resolveHost } from "#host/config.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import { BoardGateway } from "#policy.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";
import { openFleetBoard } from "#test/withFleetBoard.ts";

export function answerReadbackVerbs(state: EngineStory, tell: (line: string) => void) {
	return {
		pauseBoardScan: () =>
			Effect.gen(function* () {
				tell("hold a Board scan after its file list and source were read");
				const source = state.sourceReads;
				if (source === undefined) {
					return yield* Effect.die("Configure tracked Board reads first");
				}
				const pause = yield* source.pauseReads;
				const board = yield* BoardGateway.pipe(Effect.provide(source.board));
				const read = yield* board.get("item.0").pipe(Effect.forkScoped);
				yield* pause.entered;
				return { read, release: pause.release };
			}),
		startHostAnswer: (workId: string, text: string) =>
			Effect.gen(function* () {
				tell(`start the host answer for ${workId}, pausing before publication`);
				const publishing = yield* Deferred.make<void>();
				const publish = yield* Deferred.make<void>();
				const reading = yield* Deferred.make<void>();
				const tracer = Tracer.make({
					span: (options) => {
						if (options.name === "Fleet.readResolution") {
							Deferred.doneUnsafe(reading, Effect.void);
						}
						return new Tracer.NativeSpan(options);
					},
				});
				const host = resolveHost(state.root, { database: syntheticDatabase, provider: "local" });
				const board = yield* openFleetBoard(state.root);
				const result = yield* withDecisionResponses(
					host,
					answerWork(host, workId, {
						background: true,
						beforePublish: () => Deferred.succeed(publishing, undefined).pipe(Effect.andThen(Deferred.await(publish))),
						text,
					}),
				).pipe(
					Effect.provideService(Fleet, running(state).fleet),
					Effect.provideService(BoardGateway, board),
					Effect.withTracer(tracer),
					Effect.forkScoped,
				);
				return {
					beforePublish: Deferred.await(publishing),
					publish: Deferred.succeed(publish, undefined),
					reading: Deferred.await(reading),
					result,
				};
			}),
	};
}
