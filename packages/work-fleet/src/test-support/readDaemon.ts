import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer, Stream } from "effect";
import { HttpServer } from "effect/unstable/http";
import type { HostParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonHostOptions, daemonHttpLayer } from "#host/daemon.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { cliProcess } from "#test/fleetCli.ts";

export function readDaemonLayer(host: FleetHost, parts?: HostParts, port = 0, onSnapshot?: () => void) {
	const main = { observedAt: 1, revision: "main-revision" };
	const options = daemonHostOptions(
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
		port,
	);
	const handlers = onSnapshot === undefined ? options.handlers : observeSnapshots(options.handlers, onSnapshot);
	return daemonHttpLayer({ ...options, handlers });
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
	return yield* use(address.port).pipe(Effect.provideContext(context));
}, Effect.scoped);

export function daemonCli(host: FleetHost, args: readonly string[], parts?: HostParts) {
	return withReadDaemon(host, (port) => Effect.promise(() => cliProcess([...args, "--port", String(port)])), parts).pipe(
		Effect.provide(NodeServices.layer),
	);
}

function observeSnapshots(handlers: ReturnType<typeof daemonHostOptions>["handlers"], onSnapshot: () => void) {
	const observed = ClientContract.toLayerHandler(
		"daemon.follow",
		Effect.gen(function* () {
			const follow = yield* ClientContract.accessHandler("daemon.follow");
			return (payload, options) => {
				const result = follow(payload, options);
				const stream = Stream.isStream(result) ? result : Stream.unwrap(result.pipe(Effect.map(Stream.fromQueue)));
				return stream.pipe(Stream.tap(() => Effect.sync(onSnapshot)));
			};
		}),
	);
	return observed.pipe(Layer.provideMerge(handlers));
}
