import { Channel, Deferred, Effect, type Fiber, Scope, Stream } from "effect";
import { HttpClient, type HttpClientError, type HttpClientResponse } from "effect/http";
import type { FakeHttpHold } from "@shivaedev/test-story/server/fakeHttpService.ts";

const bodySignals = Effect.gen(function* () {
	return { interrupted: yield* Deferred.make<void>(), released: yield* Deferred.make<void>(), started: yield* Deferred.make<void>() };
});

export interface Lifecycle {
	readonly clients: string[];
	current: Effect.Success<typeof bodySignals>;
	pending?: Fiber.Fiber<unknown, unknown>;
	stall?: FakeHttpHold;
}

export const makeLifecycle = Effect.gen(function* () {
	const lifecycle: Lifecycle = { clients: [], current: yield* bodySignals };
	return lifecycle;
});

function observeStream(stream: Stream.Stream<Uint8Array, HttpClientError.HttpClientError>, signals: Lifecycle["current"]) {
	return Stream.fromChannel(
		Channel.fromTransform((upstream, scope) =>
			Effect.gen(function* () {
				// Observe the native scope without introducing another stream scope.
				yield* Scope.addFinalizer(scope, Deferred.succeed(signals.released, undefined));
				const pull = yield* Channel.toTransform(stream.channel)(upstream, scope);
				yield* Deferred.succeed(signals.started, undefined);
				return pull;
			}),
		),
	);
}

function observeResponse(response: HttpClientResponse.HttpClientResponse, signals: Lifecycle["current"]) {
	return new Proxy(response, {
		get(target, property, receiver) {
			return property === "stream" ? observeStream(target.stream, signals) : Reflect.get(target, property, receiver);
		},
	});
}

export function observeClient(client: HttpClient.HttpClient, transport: string, lifecycle: Lifecycle) {
	return client.pipe(
		HttpClient.tapRequest((request) =>
			Effect.gen(function* () {
				lifecycle.current = yield* bodySignals;
				lifecycle.clients.push(`${transport} ${request.method} ${new URL(request.url).pathname}`);
			}),
		),
		HttpClient.transformResponse(Effect.map((response) => observeResponse(response, lifecycle.current))),
	);
}
