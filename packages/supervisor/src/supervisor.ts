import { Cause, Deferred, Duration, Effect, Exit, Fiber, type Scope, SubscriptionRef } from "effect";
import type { Process } from "#Process.ts";
import { ProcessExited } from "#ProcessExited.ts";
import { ReadinessTimeout } from "#ReadinessTimeout.ts";

export interface SupervisorOptions {
	readonly backoff?: { readonly initial: Duration.Input; readonly maximum: Duration.Input };
	readonly name: string;
	readonly readinessTimeout?: Duration.Input;
}

export type ProcessState<A, E> =
	| { readonly status: "starting"; readonly restarts: number }
	| { readonly status: "ready"; readonly restarts: number; readonly pid: number; readonly value: A }
	| { readonly status: "backoff"; readonly restarts: number; readonly delay: number; readonly exit: Exit.Exit<number, E> }
	| { readonly status: "failed"; readonly cause: Cause.Cause<E> };

export const supervise = Effect.fn("Supervisor.supervise")(function* <A, E, TStartError, R>(
	start: Effect.Effect<Process<A, E>, TStartError, R | Scope.Scope>,
	options: SupervisorOptions,
) {
	const first = yield* Deferred.make<A, E | TStartError | ReadinessTimeout | ProcessExited>();
	const state = yield* SubscriptionRef.make<ProcessState<A, E | TStartError | ReadinessTimeout | ProcessExited>>({ restarts: 0, status: "starting" });
	const initial = Duration.toMillis(Duration.fromInputUnsafe(options.backoff?.initial ?? "500 millis"));
	const maximum = Duration.toMillis(Duration.fromInputUnsafe(options.backoff?.maximum ?? "5 seconds"));
	const attempt = Effect.fnUntraced(function* (restarts: number) {
		yield* SubscriptionRef.set(state, { restarts, status: "starting" });
		const child = yield* start;
		const value = yield* child.ready.pipe(
			Effect.raceFirst(child.exited.pipe(Effect.flatMap((code) => Effect.fail(new ProcessExited({ code, name: options.name }))))),
			Effect.timeoutOrElse({
				duration: options.readinessTimeout ?? "30 seconds",
				orElse: () => Effect.fail(new ReadinessTimeout({ name: options.name })),
			}),
		);
		yield* SubscriptionRef.set(state, { pid: child.pid, restarts, status: "ready", value });
		yield* Deferred.succeed(first, value);
		const exit = yield* Effect.exit(child.exited);
		if (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)) {
			return yield* Effect.failCause(exit.cause);
		}
		return exit;
	});
	const watch = Effect.gen(function* () {
		let restarts = 0;
		let delay = Math.min(initial, maximum);
		for (;;) {
			const exit = yield* Effect.scoped(attempt(restarts));
			restarts += 1;
			yield* SubscriptionRef.set(state, { delay, exit, restarts, status: "backoff" });
			yield* Effect.sleep(delay);
			delay = Math.min(delay * 2, maximum);
		}
	});
	const worker = yield* Effect.forkScoped(
		watch.pipe(
			Effect.onError((cause) => SubscriptionRef.set(state, { cause, status: "failed" })),
			Effect.onExit((exit) => Deferred.done(first, exit)),
		),
	);
	const value = yield* Deferred.await(first).pipe(Effect.onError(() => Fiber.interrupt(worker)));
	return { await: Fiber.join(worker), ready: value, state };
});
