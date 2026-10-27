import { Context, Deferred, Duration, Effect, Fiber, Layer, Stream } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { appHost } from "@shivaedev/server/appHost.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { type HostParts, hostLayer, hostScheduler, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { ClientContract, DaemonContract, RPC_PATH } from "#host/daemonContract.ts";
import { daemonHandlers } from "#host/daemonHandlers.ts";
import { publishDaemonPort } from "#host/daemonPort.ts";
import { watchedConfig } from "#host/liveConfig.ts";
import { fleetHandlers } from "#operations.ts";

const { DAEMON_PORT: DEFAULT_DAEMON_PORT } = diagnosticsApi;

export const DAEMON_HOST = "127.0.0.1";
export const DAEMON_PORT = DEFAULT_DAEMON_PORT;

class Scheduler extends Context.Service<Scheduler, Fiber.Fiber<void, unknown>>()("@shivaedev/work-fleet/DaemonScheduler") {}

export function daemonHostOptions(host: FleetHost, parts: HostParts = productionParts(host), port: number = DAEMON_PORT) {
	return {
		boardDir: host.boardDir,
		config: { disablePreemptiveShutdown: false, gracefulShutdownTimeout: Duration.infinity, host: DAEMON_HOST, port },
		group: DaemonContract,
		handlers: Layer.merge(fleetHandlers, Layer.unwrap(daemonHandlers(host))),
		policy: "loopback" as const,
		routes: HttpRouter.use((router) => router.add("GET", "/live", HttpServerResponse.empty({ status: 204 }))),
		rpcPath: RPC_PATH,
		services: hostLayer(host, parts, watchedConfig(host), true),
	};
}

export function daemonLayer(host: FleetHost, parts: HostParts = productionParts(host), port: number = DAEMON_PORT) {
	const http = daemonHttpLayer(daemonHostOptions(host, parts, port));
	const scheduler = Layer.effect(Scheduler)(hostScheduler(host).pipe(Effect.forkScoped));
	return scheduler.pipe(Layer.provideMerge(http));
}

export function daemonHttpLayer(options: ReturnType<typeof daemonHostOptions>) {
	const { boardDir, ...http } = options;
	return Layer.unwrap(
		Effect.gen(function* () {
			const stopping = yield* Deferred.make<void>();
			const follow = ClientContract.toLayerHandler(
				"daemon.follow",
				Effect.gen(function* () {
					const handler = yield* ClientContract.accessHandler("daemon.follow");
					return (payload, request) => {
						const result = handler(payload, request);
						const stream = Stream.isStream(result) ? result : Stream.unwrap(result.pipe(Effect.map(Stream.fromQueue)));
						return stream.pipe(Stream.interruptWhen(Deferred.await(stopping)));
					};
				}),
			);
			const watch = ClientContract.toLayerHandler(
				"daemon.watch",
				Effect.gen(function* () {
					const handler = yield* ClientContract.accessHandler("daemon.watch");
					return (payload, request) => {
						const result = handler(payload, request);
						const stream = Stream.isStream(result) ? result : Stream.unwrap(result.pipe(Effect.map(Stream.fromQueue)));
						return stream.pipe(Stream.interruptWhen(Deferred.await(stopping)));
					};
				}),
			);
			const handlers = Layer.merge(follow, watch).pipe(Layer.provideMerge(http.handlers));
			const prepared = yield* Layer.build(handlers);
			const server = appHost({
				...http,
				handlers: Layer.succeedContext(prepared),
				services: Layer.empty,
			});
			return Layer.effectDiscard(
				Effect.gen(function* () {
					yield* publishDaemonPort(boardDir);
					// End subscriptions before the HTTP server waits for its open responses to close.
					yield* Effect.addFinalizer(() => Deferred.succeed(stopping, undefined));
				}),
			).pipe(Layer.provideMerge(server));
		}),
	).pipe(Layer.provideMerge(options.services));
}

export function serveFleet(host: FleetHost, parts: HostParts = productionParts(host), port: number = DAEMON_PORT) {
	return Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(daemonLayer(host, parts, port));
			return yield* Fiber.join(Context.get(context, Scheduler));
		}),
	);
}
