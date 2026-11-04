import { Effect, Option, PubSub, type Scope, Stream } from "effect";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { openSessionProjection, type SessionProjection } from "#adapters/projection.ts";
import { servedTools } from "#adapters/servedTools.ts";
import { frameFor } from "#adapters/sessionFrames.ts";
import type { OpenSessionOptions, SessionHandle } from "#options.ts";
import { Provider } from "#Provider.ts";
import { openSession, promptSettings, sessionIdOf, sessionOpened } from "#sessionOpen.ts";
import { turnRequests } from "#turnRequests.ts";
import { makeTurnDriver } from "#turns.ts";

function eventsOfFrame(sessionId: string, projection: SessionProjection) {
	return (frame: unknown): Stream.Stream<AgentEvent> =>
		Stream.fromIterable(
			Option.match(frameFor(sessionId, frame), {
				onNone: (): readonly AgentEvent[] => [],
				onSome: projection.events,
			}),
		);
}
export const openOpencodeSession = Effect.fn("OpenCode.openOpencodeSession")(function* (
	options: OpenSessionOptions,
): Effect.fn.Return<SessionHandle, BackendFailure, Scope.Scope | Provider> {
	const server = yield* Provider;
	const settings = yield* promptSettings(options);
	const forEvents = yield* PubSub.subscribe(server.frames);
	const forDriver = yield* PubSub.subscribe(server.frames);
	const [route, response] = yield* openSession(options);
	const sessionId = yield* sessionIdOf(route, response);
	const tools = yield* servedTools(options.tools);
	yield* Effect.acquireRelease(
		Effect.sync(() => server.tools.remember(sessionId, tools)),
		() => Effect.sync(() => server.tools.forget(sessionId)),
	);
	const driver = yield* makeTurnDriver(yield* turnRequests(sessionId, options.cwd, settings));
	yield* Effect.forkScoped(server.exited.pipe(Effect.andThen(driver.close)));
	yield* Effect.forkScoped(
		Stream.fromSubscription(forDriver).pipe(
			Stream.runForEach((frame) =>
				Option.match(frameFor(sessionId, frame), {
					onNone: () => Effect.void,
					onSome: driver.track,
				}),
			),
		),
	);
	const projection = openSessionProjection(options.model);
	const events: Stream.Stream<AgentEvent> = Stream.make(sessionOpened(route, response, sessionId)).pipe(
		Stream.concat(Stream.fromSubscription(forEvents).pipe(Stream.flatMap(eventsOfFrame(sessionId, projection)))),
		Stream.interruptWhen(server.exited),
	);
	return {
		events,
		interrupt: driver.interrupt,
		nativeRef: Effect.succeed(Option.some(sessionId)),
		queue: (input) => driver.queue(input.parts.map((part) => part.text).join("\n")),
		steer: (input) => driver.steer(input.parts.map((part) => part.text).join("\n")),
	} satisfies SessionHandle;
});
