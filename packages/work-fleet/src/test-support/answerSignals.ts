import { Deferred, Effect, PubSub, Stream } from "effect";
import type { AnswerEvent } from "#AnswerEvent.ts";
import type { Fleet } from "#fleet.ts";

export const answerSignals = Effect.fn("AnswerStory.answerSignals")(function* (fleet: typeof Fleet.Service) {
	const subscription = yield* PubSub.subscribe(yield* fleet.answerEvents());
	const events: AnswerEvent[] = [];
	let changed = Deferred.makeUnsafe<void>();
	yield* Stream.fromSubscription(subscription).pipe(
		Stream.runForEach((event) =>
			Effect.gen(function* () {
				events.push(event);
				const previous = changed;
				changed = Deferred.makeUnsafe<void>();
				yield* Deferred.succeed(previous, undefined);
			}),
		),
		Effect.forkScoped,
	);
	function wait(predicate: (event: AnswerEvent) => boolean, count = 1): Effect.Effect<AnswerEvent> {
		return Effect.suspend(() => {
			const event = events.filter(predicate)[count - 1];
			return event === undefined ? Deferred.await(changed).pipe(Effect.andThen(wait(predicate, count))) : Effect.succeed(event);
		});
	}
	return { wait };
});

export type AnswerSignals = Effect.Success<ReturnType<typeof answerSignals>>;
