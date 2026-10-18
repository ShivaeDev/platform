import * as NodeServices from "@effect/platform-node/NodeServices";
import { Clock, Effect, Layer, Redacted } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { appDatabase } from "@shivaedev/platform/server/appHost.ts";
import type { ReportInspection } from "#engine/ReportInspection.ts";
import { fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import { type FleetHost, HostFailure } from "#host/config.ts";
import { type GithubApi, githubApiLayer } from "#host/githubApi.ts";
import { hostIntegrations } from "#host/integrations.ts";
import { type AppliedConfig, LiveConfig, staticConfig } from "#host/liveConfig.ts";
import { localOnlyBoardPath } from "#host/localOnlyBoardPath.ts";
import { MainSource } from "#host/mainSource.ts";
import { providerHealth } from "#host/providerHealth.ts";
import { hostQuota } from "#host/quota.ts";
import { hostReportBoard } from "#host/reportBoard.ts";
import { type BoardGateway, type FleetConfiguration, type FleetIntegrations, FleetPolicy } from "#policy.ts";
import { SessionService, type SessionTransport } from "#session/service.ts";
import { fleetMigrations } from "#storage/fleetMigrations.ts";

export function hostPolicy(host: FleetHost) {
	return Layer.effect(FleetPolicy)(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			const main = yield* MainSource;
			const live = yield* LiveConfig;
			const localPath = host.provider === "cloud" ? yield* localOnlyBoardPath(host.boardDir, main.repositoryRoot) : undefined;
			function now() {
				return clock.currentTimeMillisUnsafe();
			}
			// Each quota source caches its observation, so a reload reuses the source for an unchanged quota setting.
			const quotas = new Map<FleetHost["quota"], ReturnType<typeof hostQuota>>();
			function refreshQuota(applied: FleetHost) {
				const known = quotas.get(applied.quota);
				if (known !== undefined) {
					return known;
				}
				const created = hostQuota(applied, now);
				quotas.set(applied.quota, created);
				return created;
			}
			function configuration({ guidance, host: applied }: AppliedConfig): FleetConfiguration {
				return {
					areaMergeWaitMs: applied.areaMergeWaitMs,
					deliveryBacklog: applied.backlog,
					executionConcurrency: applied.concurrency,
					launch: applied.launch,
					...(localPath === undefined ? {} : { localOnlyBoardPath: localPath }),
					now,
					...(applied.openPullRequests === undefined ? {} : { openPullRequests: applied.openPullRequests }),
					operationId: () => crypto.randomUUID(),
					quota: { expiresAt: 0, observedAt: 0 },
					readGuidance: (role) => guidance[role].pipe(Effect.mapError((error) => new ServiceUnavailable({ message: error.message }))),
					readRetryMs: applied.readRetryMs,
					refreshQuota: refreshQuota(applied),
					stallMinutes: applied.stallMinutes,
					...(applied.worker === undefined ? {} : { sharedEnvironment: applied.worker.sharedEnvironment }),
				};
			}
			return FleetPolicy.of({ ...configuration(yield* live.current), current: Effect.map(live.current, configuration) });
		}),
	);
}

export function hostSql(host: FleetHost) {
	return appDatabase({
		config: {
			applicationName: "work-fleet",
			changes: { channel: `${host.namespace}_changes` },
			databaseUrl: Redacted.make(host.databaseUrl),
			maxConnections: host.maxConnections,
		},
		migrations: { loader: fleetMigrations(host.namespace), table: `${host.namespace}_migrations` },
	}).pipe(
		Layer.provide(
			Layer.effectDiscard(
				Effect.gen(function* () {
					if (host.maxConnections < 2) {
						return yield* Effect.fail(
							new HostFailure({ message: "Fleet database.maxConnections must be at least 2 for queries and the change listener" }),
						);
					}
				}),
			),
		),
	);
}

export function fleetHostLayer<TProvider, TMain>(
	host: FleetHost,
	parts: {
		readonly board?: Layer.Layer<BoardGateway | ReportInspection, unknown, MainSource | GithubApi>;
		readonly github?: Layer.Layer<GithubApi>;
		readonly integrations?: Layer.Layer<FleetIntegrations, unknown, MainSource | GithubApi>;
		readonly main: Layer.Layer<MainSource, TMain>;
		readonly policy?: Layer.Layer<FleetPolicy>;
		readonly provider: Layer.Layer<SessionTransport, TProvider>;
	},
	config: Layer.Layer<LiveConfig, unknown> = staticConfig(host),
) {
	const repository = postgresFleetRepository(host.namespace);
	const sessions = SessionService.layer.pipe(
		Layer.provideMerge([fleetSessionJournal.pipe(Layer.provide(repository)), providerHealth.pipe(Layer.provide(parts.provider))]),
	);
	const github = parts.github ?? githubApiLayer.pipe(Layer.provide(NodeServices.layer));
	const board = (parts.board ?? hostReportBoard(host)).pipe(Layer.provide(parts.main), Layer.provide(NodeServices.layer));
	const integrations = (parts.integrations ?? hostIntegrations(host)).pipe(Layer.provide(parts.main));
	return Fleet.layer.pipe(
		Layer.provideMerge(
			Layer.mergeAll(
				repository,
				sessions,
				board,
				parts.policy ?? hostPolicy(host).pipe(Layer.provide([parts.main, config])),
				integrations,
				parts.main,
			),
		),
		Layer.provideMerge(github),
		Layer.provideMerge(hostSql(host)),
	);
}
