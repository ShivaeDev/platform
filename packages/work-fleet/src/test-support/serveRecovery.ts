import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";
import { HttpServer } from "effect/http";
import type { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { SchedulerPasses } from "#engine/health.ts";
import type { HostParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonLayer } from "#host/daemon.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";

export function serveRecovery<A, E>(
	host: FleetHost,
	parts: HostParts,
	use: (client: Effect.Success<ReturnType<typeof daemonClient>>, context: Context.Context<typeof LiveServer.Identifier>) => Effect.Effect<A, E>,
	scheduled = true,
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const layer = scheduled ? daemonLayer(host, parts, 0) : readDaemonLayer(host, { parts });
			const context = yield* Layer.build(Layer.fresh(layer));
			if (scheduled) {
				yield* SubscriptionRef.changes(Context.get(context, SchedulerPasses)).pipe(
					Stream.takeUntil((count) => count > 0),
					Stream.runDrain,
				);
			}
			const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
			return yield* use(yield* daemonClient(url), context);
		}),
	);
}
