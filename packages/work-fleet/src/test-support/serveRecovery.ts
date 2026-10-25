import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { fleetHealth } from "@shivaedev/work-board/server/diagnostics/fleetHealth.ts";
import type { HostParts } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { daemonLayer } from "#host/daemon.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";

function schedulerReady(root: string, previous: number | null) {
	return until(() =>
		fleetHealth(root).pipe(
			Effect.map((health) => health.lastSchedulerPass !== null && health.lastSchedulerPass !== previous),
			Effect.provide(NodeServices.layer),
		),
	);
}
export function serveRecovery<A, E>(
	host: FleetHost,
	parts: HostParts,
	use: (client: Effect.Success<ReturnType<typeof daemonClient>>) => Effect.Effect<A, E>,
) {
	return Effect.scoped(
		Effect.gen(function* () {
			const previous = yield* fleetHealth(host.boardDir).pipe(Effect.option, Effect.provide(NodeServices.layer));
			const context = yield* Layer.build(Layer.fresh(daemonLayer(host, parts, 0)));
			yield* schedulerReady(host.boardDir, previous._tag === "Some" ? previous.value.lastSchedulerPass : null);
			const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
			return yield* use(yield* daemonClient(url));
		}),
	);
}
