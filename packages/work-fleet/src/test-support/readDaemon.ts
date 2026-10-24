import { NodeServices } from "@effect/platform-node";
import { Clock, Context, Effect, Layer, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { AppChanges } from "@shivaedev/platform/server/appHost.ts";
import type { HostParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonHostOptions, daemonHttpLayer, daemonLayer } from "#host/daemon.ts";
import { ClientContract } from "#host/daemonContract.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { fixedMainSource } from "#test/mainSource.ts";

export interface ReadDaemonOptions {
	readonly beforeHandlers?: Effect.Effect<void>;
	readonly handlerClock?: Clock.Clock;
	readonly onCommitSubscriptionStop?: Effect.Effect<void>;
	readonly onSnapshot?: () => void;
	readonly parts?: HostParts;
	readonly port?: number;
}

export function readDaemonLayer(
	host: FleetHost,
	{ beforeHandlers, handlerClock, onSnapshot, onCommitSubscriptionStop, parts, port = 0 }: ReadDaemonOptions = {},
) {
	const options = daemonHostOptions(
		host,
		parts ?? {
			github: syntheticGithub().layer,
			main: fixedMainSource(),
			provider: engineProvider({}, []).transport,
		},
		port,
	);
	const subscriptions =
		onCommitSubscriptionStop === undefined
			? options.handlers
			: options.handlers.pipe(
					Layer.updateService(AppChanges, (changes) => ({
						...changes,
						stream: (keys) => changes.stream(keys).pipe(Stream.ensuring(onCommitSubscriptionStop)),
					})),
				);
	const observed = onSnapshot === undefined ? subscriptions : observeSnapshots(subscriptions, onSnapshot);
	const handlers = handlerClock === undefined ? observed : observed.pipe(Layer.provide(Layer.succeed(Clock.Clock)(handlerClock)));
	return daemonHttpLayer({
		...options,
		handlers: beforeHandlers === undefined ? handlers : Layer.effectDiscard(beforeHandlers).pipe(Layer.provideMerge(handlers)),
	});
}

export const withReadDaemon = Effect.fn("DaemonTest.withReadDaemon")(function* <A, E, R>(
	host: FleetHost,
	use: (port: number) => Effect.Effect<A, E, R>,
	options: Omit<ReadDaemonOptions, "port"> = {},
) {
	const context = yield* Layer.build(readDaemonLayer(host, options));
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP daemon");
	}
	return yield* use(address.port).pipe(Effect.provideContext(context));
}, Effect.scoped);

export function daemonCli(host: FleetHost, args: readonly string[], options: Omit<ReadDaemonOptions, "port"> = {}) {
	return withReadDaemon(
		host,
		() => Effect.promise(() => cliProcess([...args, ...(args.includes("--board") ? [] : ["--board", host.boardDir])])),
		options,
	).pipe(Effect.provide(NodeServices.layer));
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

export function scheduledDaemonLayer(host: FleetHost, parts: HostParts) {
	return daemonLayer(host, parts, 0);
}
