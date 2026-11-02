import { Deferred, Effect, Fiber, Stream } from "effect";
import { until } from "@shivaedev/test-story/server/until.ts";
import { readBoundedText } from "#body.ts";
import type { ClientEngine } from "./engine.ts";

function signal(gate: Deferred.Deferred<void>, name: string) {
	return until(Stream.fromEffect(Deferred.await(gate)), () => true, { name });
}

export function lifecycleVerbs({ client, lifecycle, remote }: ClientEngine, story: { tell: (line: string) => void }) {
	return {
		abandonedRequest: () => {
			const latest = remote.requests.at(-1);
			return remote
				.untilAbandoned((request) => request === latest, { name: "abandoned body" })
				.pipe(Effect.map(({ method, path, status }) => `${method} ${path} ${status}`));
		},
		bodyScope: () => Effect.map(Deferred.isDone(lifecycle.current.released), (released) => (released ? "released" : "open")),
		clientsUsed: () => Effect.sync(() => [...lifecycle.clients]),
		interruption: () => Effect.map(Deferred.isDone(lifecycle.current.interrupted), (interrupted) => (interrupted ? "interrupted" : "running")),
		interruptReading: () => {
			story.tell("the caller interrupts the body read");
			return Effect.gen(function* () {
				if (lifecycle.pending === undefined) {
					return yield* Effect.die("Start a body read before interrupting it");
				}
				yield* Fiber.interrupt(lifecycle.pending);
				yield* signal(lifecycle.current.released, "body stream scope released");
			});
		},
		startReadingBody: () => {
			story.tell("the client starts reading the stalled body within 10 bytes");
			return Effect.gen(function* () {
				if (lifecycle.stall === undefined) {
					return yield* Effect.die("Set up a stalled body before starting a background read");
				}
				lifecycle.pending = yield* client()
					.get(`${remote.url}/body`)
					.pipe(
						Effect.flatMap((response) => readBoundedText(response, 10)),
						Effect.onInterrupt(() => Deferred.succeed(lifecycle.current.interrupted, undefined)),
						Effect.forkScoped,
					);
				yield* lifecycle.stall.waiting;
				yield* signal(lifecycle.current.started, "body stream started");
			});
		},
	};
}
