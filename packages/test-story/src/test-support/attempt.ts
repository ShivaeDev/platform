import { Cause, Effect, Exit, Fiber } from "effect";

function described(value: unknown): string {
	if (value instanceof Error && value.message !== "") {
		return "_tag" in value ? `${String(value._tag)}: ${value.message}` : value.message;
	}
	if (typeof value === "object" && value !== null && "_tag" in value) {
		return `${String(value._tag)} ${JSON.stringify({ ...value, _tag: undefined })}`;
	}
	return typeof value === "string" ? value : JSON.stringify(value);
}

export function attempt<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<string, never, R> {
	return Effect.map(Effect.exit(effect), (exit) => {
		if (Exit.isSuccess(exit)) {
			return "succeeded";
		}
		if (Cause.hasInterruptsOnly(exit.cause)) {
			return "interrupted";
		}
		const error = Cause.squash(exit.cause);
		return Cause.hasFails(exit.cause) ? `failed with ${described(error)}` : `died: ${described(error)}`;
	});
}

export function refusal<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<string, never, R> {
	return Effect.map(attempt(effect), (outcome) => outcome.split("\n")[0] ?? outcome);
}

export function refusalOf(read: () => unknown): Effect.Effect<string> {
	return Effect.sync(() => {
		try {
			read();
			return "succeeded";
		} catch (error) {
			return `threw: ${described(error).split("\n")[0]}`;
		}
	});
}

export function background() {
	const running = new Map<string, Fiber.Fiber<string>>();
	function fiberOf(name: string) {
		const fiber = running.get(name);
		if (fiber === undefined) {
			throw new Error(`Nothing named "${name}" was started.`);
		}
		return fiber;
	}
	return {
		finished: (name: string) => Fiber.join(fiberOf(name)),
		progress: (name: string, whileRunning: string) => Effect.sync(() => (fiberOf(name).pollUnsafe() === undefined ? whileRunning : "finished")),
		starts: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>, words: (value: A) => string = () => "succeeded") =>
			Effect.forkChild(
				Effect.exit(effect).pipe(
					Effect.flatMap((exit) => (Exit.isSuccess(exit) ? Effect.succeed(words(exit.value)) : attempt(Effect.failCause(exit.cause)))),
				),
			).pipe(
				Effect.tap((fiber) => Effect.sync(() => running.set(name, fiber))),
				Effect.andThen(Effect.yieldNow),
			),
	};
}
