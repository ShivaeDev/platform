import { Clock, Console, Context, Effect, FileSystem, Layer, type Option, Ref, Semaphore } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import type { FleetHealth } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { publishAfterBoardPass } from "#board/readPass.ts";
import { writeHealth } from "#board/writeHealth.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { Health, HealthPublication, HealthSnapshot } from "#engine/health.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { GithubApi } from "#host/githubApi.ts";
import type { GithubObservation } from "#host/githubRateLimit.ts";
import { executing } from "#model.ts";

const { SourceFailure } = diagnosticsApi;

class StatusHealth extends Context.Service<StatusHealth, Option.Option<Health["Service"]>>()("Fleet/StatusHealth") {}
class StatusGithub extends Context.Service<StatusGithub, Effect.Effect<readonly GithubObservation[]>>()("Fleet/StatusGithub") {}

export function statusLayer(root: string, healthConfig?: Effect.Effect<{ readonly concurrency: number; readonly staleAfterMs: number }>) {
	const StatusPublication = defineService({
		id: "Fleet/StatusPublication",
		initialize: Effect.gen(function* () {
			const fleet = yield* Fleet;
			const health = yield* StatusHealth;
			const github = yield* StatusGithub;
			const fs = yield* FileSystem.FileSystem;
			const realRoot = yield* fs.realPath(root);
			const lock = yield* Semaphore.make(1);
			const snapshot = yield* Ref.make<FleetHealth | null>(null);
			const publish = Semaphore.withPermits(
				lock,
				1,
			)(
				Effect.gen(function* () {
					const records = yield* fleet.list();
					yield* writeStatus(
						root,
						realRoot,
						records.map(({ value }) => value),
					).pipe(Effect.catch((error) => Console.error(`work-fleet: status publication failed: ${error.message}`)));
					if (healthConfig !== undefined) {
						const state = health._tag === "Some" ? yield* Ref.get(health.value) : { lastCapacityRejection: null, lastSchedulerPass: null };
						const observations = yield* github;
						const nextHealth: FleetHealth = {
							...(observations.length === 0 ? {} : { github: observations }),
							observedAt: yield* Clock.currentTimeMillis,
							version: 2,
							...(yield* healthConfig),
							...state,
							queued: records.filter(({ value }) => value.stage === "prepared").length,
							running: records.filter(({ value }) => executing(value)).length,
							waiting: waitingCounts(records.map(({ value }) => value)),
						};
						yield* Ref.set(snapshot, nextHealth);
						yield* writeHealth(root, realRoot, nextHealth);
					}
				}),
			).pipe(Effect.catch((error) => Console.error(`work-fleet: publication failed: ${error.message}`)));
			if (healthConfig !== undefined) {
				yield* publish;
			}
			return { fleet, publish, snapshot };
		}),
		methods: ({ fleet, publish, snapshot }) => {
			function after<A, E, R>(effect: Effect.Effect<A, E, R>) {
				return effect.pipe(Effect.ensuring(publishAfterBoardPass(publish)));
			}
			return {
				...fleet,
				continue: (workId: string, message: string) => after(fleet.continue(workId, message)),
				dispatch: (...args: Parameters<typeof fleet.dispatch>) => after(fleet.dispatch(...args)),
				list: () => after(fleet.list()),
				prepare: (input: Parameters<typeof fleet.prepare>[0]) => after(fleet.prepare(input)),
				publishDecision: (workId: string) => after(fleet.publishDecision(workId)),
				publishHealth: () => publishAfterBoardPass(publish),
				readHealth: () => readSnapshot(snapshot),
				reassign: (...args: Parameters<typeof fleet.reassign>) => after(fleet.reassign(...args)),
				reconcile: (workId: string) => after(fleet.reconcile(workId)),
				recordResponse: (...args: Parameters<typeof fleet.recordResponse>) => after(fleet.recordResponse(...args)),
				resolve: (...args: Parameters<typeof fleet.resolve>) => after(fleet.resolve(...args)),
			};
		},
		requires: [Fleet, FileSystem.FileSystem, StatusHealth, StatusGithub],
	});
	return Layer.unwrap(
		Effect.map(Effect.all([Effect.serviceOption(Health), Effect.serviceOption(GithubApi)]), ([health, github]) =>
			Layer.unwrap(
				Effect.map(StatusPublication, ({ readHealth, publishHealth, ...fleet }) =>
					Layer.mergeAll(Layer.succeed(HealthSnapshot, readHealth()), Layer.succeed(HealthPublication, publishHealth()), Layer.succeed(Fleet, fleet)),
				),
			).pipe(
				Layer.provide(
					StatusPublication.layer.pipe(
						Layer.provide([
							Layer.succeed(StatusHealth, health),
							Layer.succeed(StatusGithub, github._tag === "Some" ? github.value.observations() : Effect.succeed([])),
						]),
					),
				),
			),
		),
	);
}

function waitingCounts(records: Parameters<typeof views>[0]) {
	const { waiting } = views(records);
	return { automation: waiting.automation.length, maintainer: waiting.maintainer.length, orchestrator: waiting.orchestrator.length };
}

function readSnapshot(snapshot: Ref.Ref<FleetHealth | null>) {
	return Ref.get(snapshot).pipe(
		Effect.flatMap((value) =>
			value === null ? Effect.fail(new SourceFailure({ kind: "error", message: "Fleet health has not been observed" })) : Effect.succeed(value),
		),
	);
}
