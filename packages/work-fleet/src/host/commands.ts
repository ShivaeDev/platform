import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer, Stream } from "effect";
import type { ReportInspection } from "#engine/ReportInspection.ts";
import { run } from "#engine/scheduler.ts";
import { admitApproved } from "#host/admission.ts";
import type { FleetHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { healthLayer } from "#host/healthLayer.ts";
import { LiveConfig, staticConfig } from "#host/liveConfig.ts";
import { gitMainSource, type MainSource } from "#host/mainSource.ts";
import { hostProvider } from "#host/providers.ts";
import { fleetHostLayer } from "#host/runtime.ts";
import { statusLayer } from "#host/statusLayer.ts";
import type { BoardGateway, FleetIntegrations, FleetPolicy } from "#policy.ts";
import type { SessionTransport } from "#session/service.ts";

export interface HostParts {
	readonly board?: Layer.Layer<BoardGateway | ReportInspection, unknown, MainSource | GithubApi>;
	readonly github?: Layer.Layer<GithubApi>;
	readonly integrations?: Layer.Layer<FleetIntegrations, unknown, MainSource | GithubApi>;
	readonly main: Layer.Layer<MainSource, unknown>;
	readonly policy?: Layer.Layer<FleetPolicy>;
	readonly provider: Layer.Layer<SessionTransport, unknown>;
}

export function productionParts(host: FleetHost): HostParts {
	return { main: gitMainSource(host), provider: hostProvider(host) };
}

export function hostLayer(
	host: FleetHost,
	parts: HostParts,
	config: Layer.Layer<LiveConfig, unknown> = staticConfig(host),
	backgroundPublication = false,
) {
	const runtime = Layer.mergeAll(fleetHostLayer(host, parts, config), NodeServices.layer).pipe(Layer.provideMerge(healthLayer(host.boardDir)));
	const status = Layer.unwrap(
		Effect.map(LiveConfig, (live) =>
			statusLayer(
				host.boardDir,
				Effect.map(live.current, ({ host: applied }) => ({
					concurrency: applied.concurrency,
					staleAfterMs: Math.max(60_000, applied.interval * 3000),
				})),
				backgroundPublication,
			),
		),
	);
	return status.pipe(Layer.provideMerge(runtime), Layer.provideMerge(config));
}

// An applied config edit starts the next pass at once instead of after the interval it replaced, and a low GitHub budget stretches that interval.
export const schedulerPause = Effect.gen(function* () {
	const live = yield* LiveConfig;
	const github = yield* GithubApi;
	const { host: applied } = yield* live.current;
	const delay = yield* github.pace(applied.interval * 1000);
	yield* Effect.raceFirst(Effect.sleep(delay), live.changes.pipe(Stream.drop(1), Stream.take(1), Stream.runDrain));
});

export function hostScheduler(host: FleetHost) {
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
	return run(schedulerPause, admission);
}
