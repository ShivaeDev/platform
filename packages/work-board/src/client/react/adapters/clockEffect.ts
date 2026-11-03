import { Effect, Fiber } from "effect";

export function clockEffect(effect: Effect.Effect<void>) {
	const fiber = Effect.runFork(effect);
	return () => {
		Effect.runFork(Fiber.interrupt(fiber));
	};
}
