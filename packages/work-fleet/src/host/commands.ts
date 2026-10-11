import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer } from "effect";
import type { ReportInspection } from "#engine/ReportInspection.ts";
import { run } from "#engine/scheduler.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { healthLayer } from "#host/healthLayer.ts";
import { gitMainSource, type MainSource } from "#host/mainSource.ts";
import { hostProvider } from "#host/providers.ts";
import { fleetHostLayer } from "#host/runtime.ts";
import { statusLayer } from "#host/statusLayer.ts";
import type { BoardGateway, FleetIntegrations, FleetPolicy } from "#policy.ts";
import type { SessionTransport } from "#session/service.ts";

export interface HostParts {
	readonly board?: Layer.Layer<BoardGateway | ReportInspection, unknown, MainSource>;
	readonly integrations?: Layer.Layer<FleetIntegrations, unknown, MainSource>;
	readonly main: Layer.Layer<MainSource, unknown>;
	readonly policy?: Layer.Layer<FleetPolicy>;
	readonly provider: Layer.Layer<SessionTransport, unknown>;
}

export function productionParts(host: FleetHost): HostParts {
	return { main: gitMainSource(host), provider: hostProvider(host) };
}

export function hostLayer(host: FleetHost, parts: HostParts) {
	const runtime = Layer.mergeAll(fleetHostLayer(host, parts), NodeServices.layer).pipe(Layer.provideMerge(healthLayer(host.boardDir)));
	return statusLayer(host.boardDir, { concurrency: host.concurrency, staleAfterMs: Math.max(60_000, host.interval * 3000) }).pipe(
		Layer.provideMerge(runtime),
	);
}

export function runFleet(host: FleetHost, parts: HostParts = productionParts(host)) {
	let reported = new Set<string>();
	const admission = admitApproved(host).pipe(
		Effect.catch((error) => Effect.succeed([`admission: ${error.message}`])),
		Effect.flatMap((failures) =>
			Effect.gen(function* () {
				for (const failure of failures.filter((entry) => !reported.has(entry))) {
					yield* Console.error(`work-fleet: ${failure}`);
				}
				reported = new Set(failures);
			}),
		),
	);
	return Effect.scoped(run(`${host.interval} seconds`, admission.pipe(Effect.provide(NodeServices.layer)))).pipe(
		Effect.provide(hostLayer(host, parts)),
	);
}

export function dispatchWork(host: FleetHost, workId: string, parts: HostParts = productionParts(host)) {
	return dispatchApproved(host, workId).pipe(Effect.provide(hostLayer(host, parts)));
}
