import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer } from "effect";
import { run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { gitMainSource, type MainSource } from "#host/mainSource.ts";
import { hostProvider } from "#host/providers.ts";
import { fleetHostLayer } from "#host/runtime.ts";
import type { FleetIntegrations, FleetPolicy } from "#policy.ts";
import type { SessionTransport } from "#session/service.ts";

export interface HostParts {
	readonly integrations?: Layer.Layer<FleetIntegrations, unknown, MainSource>;
	readonly main: Layer.Layer<MainSource, unknown>;
	readonly policy?: Layer.Layer<FleetPolicy>;
	readonly provider: Layer.Layer<SessionTransport, unknown>;
}

export function productionParts(host: FleetHost): HostParts {
	return { main: gitMainSource(host), provider: hostProvider(host) };
}

export function hostLayer(host: FleetHost, parts: HostParts) {
	return Layer.mergeAll(fleetHostLayer(host, parts), NodeServices.layer);
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

export function continueWork(host: FleetHost, workId: string, message: string, parts: HostParts = productionParts(host)) {
	return Effect.gen(function* () {
		return yield* (yield* Fleet).continue(workId, message);
	}).pipe(Effect.provide(hostLayer(host, parts)));
}
