import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Effect, Layer, Redacted } from "effect";
import type { ReportInspection } from "#engine/ReportInspection.ts";
import { fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { githubResult } from "#host/githubResult.ts";
import { hostGuidance } from "#host/guidance.ts";
import { MainSource } from "#host/mainSource.ts";
import { providerHealth } from "#host/providerHealth.ts";
import { hostQuota } from "#host/quota.ts";
import { hostReportBoard } from "#host/reportBoard.ts";
import { type BoardGateway, FleetFailure, FleetIntegrations, FleetPolicy } from "#policy.ts";
import { SessionService, type SessionTransport } from "#session/service.ts";

function unconfigured(what: string) {
	return Effect.fail(
		new FleetFailure({
			attentionOwner: "automation",
			message: `${what} is not configured in this Fleet host; inspect the worker session`,
			reason: "integration",
		}),
	);
}

export function hostIntegrations(host: FleetHost) {
	return Layer.effect(FleetIntegrations)(
		Effect.gen(function* () {
			const main = yield* MainSource;
			return FleetIntegrations.of({
				checks: (_work, result) =>
					result.kind === "no-change" ? unconfigured("No-change validation") : githubChecks(result).pipe(Effect.provide(NodeServices.layer)),
				delivery: githubDelivery(main.repositoryRoot),
				main: main.observe,
				result: host.result === "github" ? githubResult(host, main) : () => unconfigured("Worker result adoption"),
			});
		}),
	);
}

export function hostPolicy(host: FleetHost) {
	return Layer.effect(FleetPolicy)(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			const reviewerGuidance = yield* hostGuidance(host, "reviewer");
			const workerGuidance = yield* hostGuidance(host, "worker");
			function now() {
				return clock.currentTimeMillisUnsafe();
			}
			return FleetPolicy.of({
				areaMergeWaitMs: host.areaMergeWaitMs,
				deliveryBacklog: host.backlog,
				executionConcurrency: host.concurrency,
				launch: host.launch,
				now,
				operationId: () => crypto.randomUUID(),
				quota: { expiresAt: 0, observedAt: 0 },
				refreshQuota: hostQuota(host, now),
				...(reviewerGuidance === undefined ? {} : { reviewerGuidance }),
				...(host.worker === undefined ? {} : { sharedEnvironment: host.worker.sharedEnvironment }),
				...(workerGuidance === undefined ? {} : { workerGuidance }),
			});
		}),
	);
}

export function hostSql(host: FleetHost) {
	return PgClient.layer({ applicationName: "work-fleet", maxConnections: host.maxConnections, url: Redacted.make(host.databaseUrl) });
}

export function fleetHostLayer<TProvider, TMain>(
	host: FleetHost,
	parts: {
		readonly board?: Layer.Layer<BoardGateway | ReportInspection, unknown, MainSource>;
		readonly integrations?: Layer.Layer<FleetIntegrations, unknown, MainSource>;
		readonly main: Layer.Layer<MainSource, TMain>;
		readonly policy?: Layer.Layer<FleetPolicy>;
		readonly provider: Layer.Layer<SessionTransport, TProvider>;
	},
) {
	const repository = postgresFleetRepository(host.namespace).pipe(Layer.provideMerge(hostSql(host)));
	const sessions = SessionService.layer.pipe(
		Layer.provideMerge([fleetSessionJournal.pipe(Layer.provide(repository)), providerHealth.pipe(Layer.provide(parts.provider))]),
	);
	const board = (parts.board ?? hostReportBoard(host)).pipe(Layer.provide(parts.main), Layer.provide(NodeServices.layer));
	const integrations = (parts.integrations ?? hostIntegrations(host)).pipe(Layer.provide(parts.main));
	return Fleet.layer.pipe(
		Layer.provideMerge(Layer.mergeAll(repository, sessions, board, parts.policy ?? hostPolicy(host), integrations, parts.main)),
	);
}
