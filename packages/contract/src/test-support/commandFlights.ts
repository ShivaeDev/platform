import { Effect, Fiber, SubscriptionRef } from "effect";
import { until } from "@shivaedev/test-story/server/until.ts";
import { type ClientActivity, isClientSettled } from "#clientActivity.ts";
import { CommandSignal, untilReflected } from "#commandSignal.ts";
import { answered } from "#test/answers.ts";

interface Flights<R> {
	readonly activity: ClientActivity;
	readonly flight: { command: Fiber.Fiber<string> | undefined };
	readonly run: <A, E>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, unknown>;
	readonly states: SubscriptionRef.SubscriptionRef<readonly string[]>;
}

// A command runs until it is reflected, and every signal it sends is kept in order so a story reads how far it got.
export function commandFlights<R>(engine: Flights<R>, tell: (line: string) => void) {
	function begin<A, E>(words: string, command: Effect.Effect<A, E, R>) {
		return Effect.gen(function* () {
			tell(words);
			const followed = untilReflected(command).pipe(
				Effect.provideService(CommandSignal, (state) => Effect.runSync(SubscriptionRef.update(engine.states, (seen) => [...seen, state]))),
			);
			engine.flight.command = yield* answered(engine.run(followed), () => "reflected").pipe(Effect.forkScoped);
		});
	}
	function finished() {
		return Effect.suspend(() => (engine.flight.command === undefined ? Effect.die("Begin a command first") : Fiber.join(engine.flight.command)));
	}
	return {
		activity: () =>
			Effect.map(engine.activity.current, (state) => {
				if (state.unreflectedCommands > 0) {
					return `${state.unreflectedCommands} not yet reflected`;
				}
				return isClientSettled(state) ? "settled" : "pending";
			}),
		begin,
		complete: <A, E>(words: string, command: Effect.Effect<A, E, R>) => Effect.andThen(begin(words, command), finished()),
		finished,
		signals: () => SubscriptionRef.get(engine.states),
		untilAccepted: () => until(SubscriptionRef.changes(engine.states), (seen) => seen.includes("accepted"), { name: "accepted command" }),
	};
}
