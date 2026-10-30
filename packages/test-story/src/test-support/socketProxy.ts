import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Fiber, Queue, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { forwardingProxy } from "#forwardingProxy.ts";
import { storyKit } from "#storyKit.ts";
import { ipv4OnlySockets } from "./ipv4OnlySockets.ts";
import { proxyTransport } from "./proxyTransport.ts";
import { ReadPage, readPageHost } from "./readPageHost.ts";

export const socketProxy = storyKit({
	around: (effect) => Effect.scoped(ipv4OnlySockets.pipe(Effect.andThen(effect))),
	clock: "live",
	*create() {
		const host = yield* readPageHost;
		const upstream = new URL(host.url).origin;
		const proxy = yield* forwardingProxy(upstream);
		const transport = yield* proxyTransport;
		const client = yield* makeClient(ReadPage, { url: `${proxy.url}/rpc`, webSocketConstructor: transport.webSocketConstructor }).client;
		const writer = yield* makeClient(ReadPage, { url: host.url, webSocketConstructor: layerWebSocketConstructorWS }).client;
		const hints = yield* Queue.unbounded<LiveHint>();
		yield* client["page.$changes"]({ queries: [{ payload: { id: 1 }, query: "get" }] }).pipe(
			Stream.runForEach((hint) => Queue.offer(hints, hint)),
			Effect.forkScoped,
		);
		const initialHint = yield* Queue.take(hints);
		const initialResult = yield* client["page.get"]({ id: 1 });
		yield* transport.opened;
		yield* Queue.clear(transport.sent);
		const pending: { read?: Fiber.Fiber<string, unknown>; reconnect?: Promise<void>; reconnected: boolean } = { reconnected: false };
		return { client, hints, initialHint, initialResult, pending, proxy, transport, writer };
	},
	inspect: ({ pending, transport }) => ({ reconnected: pending.reconnected, sockets: transport.addresses() }),
	name: "WebSocket forwarding proxy",
	stages: [],
	verbs: ({ client, hints, initialHint, initialResult, pending, proxy, transport, writer }, story) => ({
		clientCloses: () => transport.closed,
		clientOpens: () => transport.opened,
		disconnect: () =>
			Effect.sync(() => {
				story.tell("the proxy drops the client's connection");
				pending.reconnected = false;
				pending.reconnect = proxy.disconnect().then(() => {
					pending.reconnected = true;
				});
			}),
		gateClientFrames: () => Effect.sync(transport.gateFrames),
		hold: () => {
			story.tell("the proxy holds traffic in both directions");
			return Effect.sync(proxy.hold);
		},
		initialHint: () => initialHint,
		initialResult: () => initialResult,
		nextHint: () => Queue.take(hints),
		online: () => {
			story.tell("the proxy restores traffic");
			return Effect.sync(proxy.online);
		},
		queuedHints: () => Queue.clear(hints),
		read: () => client["page.get"]({ id: 1 }),
		readElsewhere: () => writer["page.get"]({ id: 1 }),
		readPending: () => pending.read?.pollUnsafe() === undefined,
		readResult: () => {
			if (pending.read === undefined) {
				return Effect.die("Start a page read before awaiting its result.");
			}
			return Fiber.join(pending.read);
		},
		reconnected: () => pending.reconnected,
		reconnection: () => {
			const reconnect = pending.reconnect;
			if (reconnect === undefined) {
				return Effect.die("Drop the connection before awaiting reconnection.");
			}
			return Effect.promise(() => reconnect);
		},
		releaseClientFrames: () => Effect.sync(transport.releaseFrames),
		sockets: transport.addresses,
		socketUrl: () => `${proxy.url.replace(/^http/u, "ws")}/rpc`,
		startsRead: () =>
			Effect.gen(function* () {
				story.tell("the client asks for the page over its shared WebSocket");
				yield* Queue.clear(transport.sent);
				pending.read = yield* client["page.get"]({ id: 1 }).pipe(Effect.forkScoped);
				yield* Queue.take(transport.sent);
			}),
		waitForClientFrame: () => transport.buffered,
		writeElsewhere: (title: string) => {
			story.tell(`another client writes ${JSON.stringify(title)}`);
			return writer["page.write"]({ id: 1, title });
		},
	}),
});
