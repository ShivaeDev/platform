import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Effect, Layer, Redacted } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { MainSource } from "#host/mainSource.ts";
import { hostQuota } from "#host/quota.ts";
import { FleetFailure, FleetIntegrations, FleetPolicy } from "#policy.ts";
import { SessionService, type SessionTransport } from "#session/service.ts";

function unconfigured(what: string) {
	return Effect.fail(
		new FleetFailure({ message: `${what} is not configured in this Fleet host; inspect the worker session`, reason: "integration" }),
	);
}

export const hostIntegrations = Layer.effect(FleetIntegrations)(
	Effect.gen(function* () {
		const main = yield* MainSource;
		return FleetIntegrations.of({
			authorize: () => Effect.succeed(false),
			checks: (_work, result) => githubChecks(result).pipe(Effect.provide(NodeServices.layer)),
			delivery: () => unconfigured("Delivery observation"),
			main: main.observe,
			merge: () => unconfigured("Merge"),
			result: () => unconfigured("Worker result adoption"),
		});
	}),
);

export function hostPolicy(host: FleetHost) {
	return Layer.effect(FleetPolicy)(
		Effect.gen(function* () {
			const clock = yield* Clock.Clock;
			function now() {
				return clock.currentTimeMillisUnsafe();
			}
			return FleetPolicy.of({
				deliveryBacklog: host.backlog,
				executionConcurrency: host.concurrency,
				launch: host.launch,
				now,
				operationId: () => crypto.randomUUID(),
				quota: { expiresAt: 0, observedAt: 0 },
				refreshQuota: hostQuota(host, now),
				...(host.worker === undefined ? {} : { sharedEnvironment: host.worker.sharedEnvironment }),
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
		readonly integrations?: Layer.Layer<FleetIntegrations, unknown, MainSource>;
		readonly main: Layer.Layer<MainSource, TMain>;
		readonly policy?: Layer.Layer<FleetPolicy>;
		readonly provider: Layer.Layer<SessionTransport, TProvider>;
	},
) {
	const repository = postgresFleetRepository(host.namespace).pipe(Layer.provide(hostSql(host)));
	const sessions = SessionService.layer.pipe(Layer.provide([fleetSessionJournal.pipe(Layer.provide(repository)), parts.provider]));
	const board = markdownBoard(host.boardDir).pipe(Layer.provide(NodeServices.layer));
	const integrations = (parts.integrations ?? hostIntegrations).pipe(Layer.provide(parts.main));
	return Fleet.layer.pipe(
		Layer.provideMerge(Layer.mergeAll(repository, sessions, board, parts.policy ?? hostPolicy(host), integrations, parts.main)),
	);
}
