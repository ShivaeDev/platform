import { Deferred, Effect, Fiber } from "effect";
import type { PolicyHost } from "./host.ts";

export const policyProbe = Effect.gen(function* () {
	const started = yield* Deferred.make<void>();
	const interrupted = yield* Deferred.make<void>();
	const probe = {
		cancel: <A, E, R>(lookup: Effect.Effect<A, E, R>) =>
			Effect.gen(function* () {
				const request = yield* lookup.pipe(Effect.forkChild);
				yield* Effect.raceFirst(
					Deferred.await(started),
					Fiber.join(request).pipe(Effect.andThen(Effect.die("The request finished before its policy started"))),
				);
				yield* Fiber.interrupt(request);
			}),
		check: <A, E, R>(check: Effect.Effect<A, E, R>) =>
			Effect.gen(function* () {
				if (probe.waiting) {
					yield* Deferred.succeed(started, undefined);
					return yield* Effect.never.pipe(Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)));
				}
				return yield* check;
			}),
		interrupted: Deferred.isDone(interrupted),
		waiting: false,
	};
	return probe;
});

export function requestWork<TPerson extends string>(
	probe: Effect.Success<typeof policyProbe>,
	cookies: ReadonlyMap<TPerson, string>,
	host: () => PolicyHost,
	tell: (line: string) => void,
) {
	return {
		cancelRequest: (person: TPerson) => {
			tell(`${person} cancels a request while its sign-in policy is waiting`);
			return probe.cancel(host().resolveSession(cookies.get(person) ?? ""));
		},
		gateLogs: () =>
			Effect.sync(() =>
				host()
					.logs.filter(({ message }) => Array.isArray(message) && message.includes("The sign-in policy revoked a user's sessions"))
					.map(({ annotations, traceId }) => ({ method: annotations["rpc.method"], requestId: annotations.requestId, traceId })),
			),
		policyInterrupted: () => probe.interrupted,
		requestSpans: () =>
			Effect.sync(() =>
				host()
					.spans.filter((span) => span.kind === "server" && span.name === "Whoami")
					.map((span) => span.traceId),
			),
	};
}
