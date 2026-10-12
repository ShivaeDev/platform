import { Context, Effect, Fiber, Layer } from "effect";
import { appHost } from "@shivaedev/platform/appHost.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import { type HostParts, hostLayer, hostScheduler, productionParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { DaemonContract, RPC_PATH } from "#host/daemonContract.ts";
import { daemonHandlers } from "#host/daemonHandlers.ts";
import { fleetHandlers } from "#operations.ts";

const { DAEMON_PORT: DEFAULT_DAEMON_PORT } = diagnosticsApi;

export const DAEMON_HOST = "127.0.0.1";
export const DAEMON_PORT = DEFAULT_DAEMON_PORT;

class Scheduler extends Context.Service<Scheduler, Fiber.Fiber<void, unknown>>()("@shivaedev/work-fleet/DaemonScheduler") {}

export function daemonHostOptions(host: FleetHost, parts: HostParts = productionParts(host), port: number = DAEMON_PORT) {
	return {
		config: { disablePreemptiveShutdown: true, host: DAEMON_HOST, port },
		group: DaemonContract,
		handlers: Layer.merge(fleetHandlers, Layer.unwrap(daemonHandlers(host))),
		rpcPath: RPC_PATH,
		services: hostLayer(host, parts),
		sessions: "loopback" as const,
	};
}

export function daemonLayer(host: FleetHost, parts: HostParts = productionParts(host), port: number = DAEMON_PORT) {
	const http = appHost(daemonHostOptions(host, parts, port));
	const scheduler = Layer.effect(Scheduler)(hostScheduler(host).pipe(Effect.forkScoped));
	return scheduler.pipe(Layer.provideMerge(http));
}

export function serveFleet(host: FleetHost, parts: HostParts = productionParts(host), port: number = DAEMON_PORT) {
	return Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(daemonLayer(host, parts, port));
			return yield* Fiber.join(Context.get(context, Scheduler));
		}),
	);
}
