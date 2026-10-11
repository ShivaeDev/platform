import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Fiber, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { DAEMON_PORT as DEFAULT_DAEMON_PORT } from "@shivaedev/work-board/diagnostics/daemonContract.ts";
import { type HostParts, hostLayer, hostScheduler, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonRpc } from "#host/daemonRpc.ts";

export const DAEMON_HOST = "127.0.0.1";
export const DAEMON_PORT = DEFAULT_DAEMON_PORT;

class Scheduler extends Context.Service<Scheduler, Fiber.Fiber<void, unknown>>()("@shivaedev/work-fleet/DaemonScheduler") {}

export function daemonLayer(host: FleetHost, parts: HostParts = productionParts(host), port = DAEMON_PORT) {
	const runtime = hostLayer(host, parts);
	const scheduler = Layer.effect(Scheduler)(hostScheduler(host).pipe(Effect.forkScoped));
	const listener = NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: DAEMON_HOST, port });
	const http = HttpRouter.serve(daemonRpc(host), { disableLogger: true }).pipe(Layer.provideMerge(listener));
	return scheduler.pipe(Layer.provideMerge(http), Layer.provide(runtime));
}

export function serveFleet(host: FleetHost, parts: HostParts = productionParts(host), port = DAEMON_PORT) {
	return Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(daemonLayer(host, parts, port));
			return yield* Fiber.join(Context.get(context, Scheduler));
		}),
	);
}
