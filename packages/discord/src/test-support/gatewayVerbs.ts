import { Effect, Fiber, Queue, Stream } from "effect";
import type { fakeDiscord } from "@shivaedev/test-kits/discord/fake.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import type { DiscordGateway } from "#DiscordGateway.ts";
import type { GatewayDispatch } from "#gatewayProtocol.ts";

type Fake = Effect.Success<ReturnType<typeof fakeDiscord>>;

export function gatewayVerbs(
	engine: Fake & { events: Queue.Queue<GatewayDispatch>; gatewayClient: typeof DiscordGateway.Service },
	tell: (line: string) => void,
) {
	let running: Fiber.Fiber<never, Effect.Error<ReturnType<typeof engine.gatewayClient.run>>> | undefined;
	const nextEvent = Queue.take(engine.events);
	return {
		closedSockets: () => Effect.sync(() => (engine.gateway.closed() === 0 ? "open" : "closed")),
		connect: () =>
			Effect.gen(function* () {
				tell("the bot connects to Discord");
				running = yield* engine.gatewayClient.run((event) => Queue.offer(engine.events, event).pipe(Effect.asVoid)).pipe(Effect.forkScoped);
				return yield* nextEvent;
			}),
		dispatch: (type: string, data: unknown) => engine.gateway.dispatch(type, data),
		dropSocket: (code?: number) => {
			tell("Discord drops the socket");
			return engine.gateway.drop(code);
		},
		gatewayFailure: () => {
			if (running === undefined) {
				return Effect.die("Connect before observing the gateway failure");
			}
			return Fiber.join(running).pipe(Effect.catchTag("DiscordGatewayClosed", (error) => Effect.succeed(error.code)));
		},
		heartbeatDeadlinePasses: () => untilTimer("30 seconds").pipe(Effect.andThen(passes("30 seconds", engine.gateway.nextClosed))),
		heartbeatIntervalPasses: () =>
			untilTimer("30 seconds").pipe(
				Effect.andThen(
					passes(
						"30 seconds",
						until(Stream.fromEffectRepeat(engine.gateway.nextSent), (frame) => frame.op === 1, { name: "gateway heartbeat" }),
					),
				),
			),
		invalidateSession: (resumable = false) => engine.gateway.invalidate(resumable),
		malformedFrame: () => engine.gateway.malformedFrame(),
		nextEvent: () => nextEvent,
		outboundFrames: () => Effect.sync(() => engine.gateway.frames),
		protocolFailure: () =>
			running === undefined
				? Effect.die("Connect before observing a protocol failure")
				: Fiber.join(running).pipe(Effect.catchTag("DiscordGatewayProtocolError", () => Effect.succeed("invalid gateway frame"))),
		reconnectIntervalPasses: () => {
			tell("one second passes before reconnecting");
			return untilTimer("1 second").pipe(Effect.andThen(passes("1 second", nextEvent)));
		},
		requestReconnect: () => engine.gateway.requestReconnect(),
		socketDestinations: () => Effect.sync(() => [...engine.gateway.urls]),
		stop: () => (running === undefined ? Effect.void : Fiber.interrupt(running)),
		stopAcknowledging: () => engine.gateway.stopAcknowledging(),
	};
}
