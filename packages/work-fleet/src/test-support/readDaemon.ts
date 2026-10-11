import { createServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { vi } from "vitest";
import { type HostParts, hostLayer } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonRpc } from "#host/daemonRpc.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { cliProcess } from "#test/fleetCli.ts";

export function readDaemonLayer(host: FleetHost, parts?: HostParts, port = 0, onSnapshot?: () => void) {
	const main = { observedAt: 1, revision: "main-revision" };
	const runtime = hostLayer(
		host,
		parts ?? {
			main: Layer.succeed(MainSource)({
				current: Effect.succeed(main),
				observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, main)),
				refresh: Effect.succeed(main),
				repositoryRoot: "/synthetic-repository",
			}),
			provider: engineProvider({}, []).transport,
		},
	);
	return HttpRouter.serve(daemonRpc(host), { disableLogger: true }).pipe(
		Layer.provideMerge(
			NodeHttpServer.layer(onSnapshot === undefined ? createServer : snapshotServer(onSnapshot), {
				disablePreemptiveShutdown: true,
				host: "127.0.0.1",
				port,
			}),
		),
		Layer.provide(runtime),
	);
}

export const withReadDaemon = Effect.fn("DaemonTest.withReadDaemon")(function* <A, E, R>(
	host: FleetHost,
	use: (port: number) => Effect.Effect<A, E, R>,
	parts?: HostParts,
	onSnapshot?: () => void,
) {
	const context = yield* Layer.build(readDaemonLayer(host, parts, 0, onSnapshot));
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (address._tag !== "TcpAddress") {
		return yield* Effect.die("Expected a TCP daemon");
	}
	return yield* use(address.port);
}, Effect.scoped);

export function daemonCli(host: FleetHost, args: readonly string[], parts?: HostParts) {
	return withReadDaemon(host, (port) => Effect.promise(() => cliProcess([...args, "--port", String(port)])), parts).pipe(
		Effect.provide(NodeServices.layer),
	);
}

function snapshotServer(onSnapshot: () => void) {
	return () => {
		const server = createServer();
		server.on("request", (_request, response) => {
			const write = response.write.bind(response);
			vi.spyOn(response, "write").mockImplementation((...args) => {
				const chunk = args[0];
				const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
				if (text.includes('"Chunk"')) {
					onSnapshot();
				}
				return write(...args);
			});
		});
		return server;
	};
}
