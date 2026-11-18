import { Context, Effect, Latch } from "effect";

export type CommandState = "sent" | "accepted" | "reflected";

export const CommandSignal = Context.Reference<(state: CommandState) => void>("@shivaedev/contract/CommandSignal", {
	defaultValue: () => () => undefined,
});

export const untilReflected = Effect.fnUntraced(function* <A, E, R>(command: Effect.Effect<A, E, R>) {
	const outer = yield* CommandSignal;
	const reflected = Latch.makeUnsafe(true);
	let accepted = 0;
	const result = yield* Effect.provideService(command, CommandSignal, (state) => {
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
	});
	yield* reflected.await;
	return result;
});
