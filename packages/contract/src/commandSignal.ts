import { Context, Effect, Latch } from "effect";

export type CommandState = "sent" | "accepted" | "reflected";

export const CommandSignal = Context.Reference<(state: CommandState) => void>("@shivaedev/contract/CommandSignal", {
	defaultValue: () => () => undefined,
});

export const untilReflected = Effect.fnUntraced(function* <A, E, R>(command: Effect.Effect<A, E, R>) {
	const outer = yield* CommandSignal;
	const reflected = yield* Latch.make(true);
	// The command reports its states synchronously, so the signal that counts them is built as a side effect.
	const signal = Effect.sync(() => {
		let accepted = 0;
		return (state: CommandState) => {
			outer(state);
			if (state === "accepted") {
				accepted += 1;
				reflected.closeUnsafe();
			} else if (state === "reflected") {
				accepted -= 1;
				if (accepted === 0) {
					reflected.openUnsafe();
				}
			}
		};
	});
	const result = yield* Effect.provideServiceEffect(command, CommandSignal, signal);
	yield* reflected.await;
	return result;
});
