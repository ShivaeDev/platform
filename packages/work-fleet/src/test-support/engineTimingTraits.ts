import { Deferred, Effect } from "effect";
import type { BoardGateway } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
import { activeTurn } from "#test/activeTurn.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import type { EngineStory } from "#test/engineState.ts";
import type { EngineTiming } from "#test/engineTimingState.ts";

export function steeredTurnActive(waitForMerge = false) {
	return engineConfiguration("a steered worker turn is still active", (state) =>
		Effect.gen(function* () {
			const active = yield* activeTurn("Another operation owns this thread.");
			state.timing = { active, recoveries: 0, steers: 0 };
			const delivery = waitForMerge
				? {
						deliveryQuery: (result: { head: string; pr: string }) =>
							Effect.succeed(state.deliveryMerged ? { head: result.head, revision: "merge-commit", url: result.pr } : undefined),
						launch: { effort: "high" as const, model: "synthetic-model" },
					}
				: {};
			return { ...delivery, decorateTransport: active.decorateTransport };
		}),
	);
}
export function pausedReview(betweenPasses = false) {
	return engineConfiguration("review observation can pause while unrelated work proceeds", (state) =>
		Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			state.timing = { entered, recoveries: 0, resume, steers: 0 };
			return {
				reviewGate: betweenPasses ? Effect.void : Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(resume))),
				reviewRunning: betweenPasses,
			};
		}),
	);
}
export function pausedSteer(failure: boolean, interrupted = false) {
	return engineConfiguration("steering pauses after its durable intent", (state) =>
		Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			const steerRequests: NonNullable<EngineTiming["steerRequests"]> = [];
			const timing: EngineTiming = { entered, recoveries: 0, resume, steerRequests, steers: 0 };
			state.timing = timing;
			const steer = Effect.fnUntraced(function* (
				transport: typeof SessionTransport.Service,
				receipt: Parameters<NonNullable<typeof SessionTransport.Service.steer>>[0],
				prompt: string,
			) {
				timing.steers += 1;
				steerRequests.push({ prompt, receipt });
				yield* Deferred.succeed(entered, undefined);
				yield* interrupted ? Effect.never : Deferred.await(resume);
				if (failure) {
					return yield* new SessionFailure({ message: "Steer failed", reason: "unavailable" });
				}
				yield* transport.steer?.(receipt, prompt) ?? Effect.die("Missing synthetic steer");
			});
			return {
				decorateTransport: (transport: typeof SessionTransport.Service) => ({
					...transport,
					steer: (receipt, prompt) => steer(transport, receipt, prompt),
				}),
				...(interrupted ? { reviewRunning: true } : {}),
			};
		}),
	);
}
export function answerReceiptDuringBoardRead() {
	return (state: EngineStory) =>
		Effect.gen(function* () {
			const acknowledgement = yield* Deferred.make<void>();
			const timing: EngineTiming = { acknowledgement, beforeObservation: Effect.void, recoveries: 0, steers: 0 };
			state.timing = timing;
			return {
				continuationGate: Deferred.await(acknowledgement),
				decorateBoard: (board: typeof BoardGateway.Service) => ({
					...board,
					get: (id: string) => board.get(id).pipe(Effect.tap(() => timing.beforeObservation ?? Effect.void)),
				}),
				decorateTransport: (transport: typeof SessionTransport.Service) => ({
					...transport,
					reconcile: () => {
						timing.recoveries += 1;
						return Effect.fail(
							new SessionFailure({ message: "No matching accepted turn is observable; absence does not authorize replay", reason: "ambiguous" }),
						);
					},
				}),
			};
		});
}
