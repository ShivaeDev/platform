import { Cause, type Duration, Effect, Option, Predicate, Schedule } from "effect";

export function liveRetry<E, R>(
	attempt: Effect.Effect<void, E, R>,
	ended: (failure: Option.Option<Cause.Cause<E>>, retry: boolean) => void,
	delay: Duration.Input = "1 second",
) {
	const next = Effect.matchCause(attempt, {
		onFailure: (failure) => {
			const error = Cause.findErrorOption(failure);
			const retry = Option.isNone(error) || Predicate.isTagged(error.value, "RpcClientError");
			ended(Option.some(failure), retry);
			return retry;
		},
		onSuccess: () => {
			ended(Option.none(), true);
			return true;
		},
	});
	return Effect.repeat(next, {
		schedule: Schedule.jittered(Schedule.min([Schedule.exponential(delay, 2), Schedule.spaced("30 seconds")])),
		while: (retry) => retry,
	}).pipe(Effect.asVoid);
}
