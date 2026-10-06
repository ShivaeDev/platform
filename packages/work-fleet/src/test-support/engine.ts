import { Effect, Layer } from "effect";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { Fleet } from "#fleet.ts";
import { backlog, executing, FleetRecord, owns, reservations } from "#model.ts";
import { BoardFailure, BoardGateway, type BoardWork, type FleetConfiguration, FleetPolicy } from "#policy.ts";
import { SessionJournal, SessionService } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import { prepared } from "#test/preparation.ts";
import { withStorage } from "#test/storage.ts";
export interface EngineFixture extends Omit<EngineProvider, "transport"> {
	readonly acknowledgeTurn: (operationId: string, receipt: { readonly sessionId: string; readonly turnId: string }) => Effect.Effect<void, unknown>;
	readonly decisions: readonly string[];
	readonly foreign: (owner: string, paths: readonly string[]) => Effect.Effect<void, unknown>;
	readonly merged: readonly string[];
	readonly restart: <TResult, TFailure>(effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>) => Effect.Effect<TResult, TFailure>;
	readonly reviews: readonly string[];
	readonly work: (id: string) => BoardWork;
}
function boardWork(id: string): BoardWork {
	return {
		context: `Work ${id}`,
		dependsOn: id === "dependent" ? ["one"] : [],
		revision: `board-${id}`,
		sourcePath: `board/${id}.md`,
		workId: id,
	};
}
function boardLayer(options: EngineOptions, decisions: string[]) {
	let failed = false;
	return Layer.succeed(BoardGateway)({
		decision: (id, input) =>
			Effect.gen(function* () {
				if (options.publishGate !== undefined) {
					yield* options.publishGate;
				}
				if (options.publishFailure && !failed) {
					failed = true;
					return yield* Effect.fail(new BoardFailure({ message: "Board publication unavailable" }));
				}
				decisions.push(input.reason);
				return `${id}.${input.id}`;
			}),
		get: (id) => Effect.succeed(boardWork(id)),
	});
}
export function withEngine<A, E>(options: EngineOptions, use: (fixture: EngineFixture) => Effect.Effect<A, E, typeof Fleet.Identifier>) {
	return withStorage((_unused, namespace) =>
		Effect.gen(function* () {
			const store = yield* makePostgresFleetStore(FleetRecord, {
				backlog,
				executing,
				namespace,
				owns,
				reservations,
				submissions: (record, since) => record.attempts.filter((attempt) => attempt.submittedAt >= since).length,
			});
			const provider = engineProvider(options);
			const decisions: string[] = [];
			const reviews: string[] = [];
			const merged: string[] = [];
			let operationCount = 0;
			const policy: FleetConfiguration = {
				approved: { dependent: "board-dependent", one: "board-one", two: "board-two" },
				deliveryBacklog: options.backlog ?? 2,
				executionConcurrency: options.concurrency ?? 2,
				now: () => 100,
				operationId: () => {
					operationCount += 1;
					return options.operationCollision ? "operation-fixed" : `operation-${operationCount}`;
				},
				quota: { ...(options.unknownQuota ? {} : { available: options.quota ?? 100 }), expiresAt: 1000, observedAt: 0 },
			};
			const base = Layer.mergeAll(
				Layer.succeed(FleetRepository)(store),
				boardLayer(options, decisions),
				Layer.succeed(FleetPolicy)(policy),
				provider.transport,
			);
			const session = SessionService.layer.pipe(Layer.provide(Layer.merge(base, fleetSessionJournal.pipe(Layer.provide(base)))));
			const integrations = engineIntegrations(options, provider, reviews, merged).pipe(Layer.provide(session));
			const fleetLayer = Fleet.layer.pipe(Layer.provide(Layer.mergeAll(base, session, integrations)));
			function foreign(owner: string, paths: readonly string[]) {
				return store.reserveForeign(owner, paths, { backlog: true, executing: false });
			}
			if (options.foreign !== undefined) {
				yield* foreign("foreign-pr", options.foreign);
			}
			const journal = yield* SessionJournal.pipe(Effect.provide(fleetSessionJournal.pipe(Layer.provide(base))));
			const fixture: EngineFixture = {
				...provider,
				acknowledgeTurn: journal.acknowledgeTurn,
				decisions,
				foreign,
				merged,
				restart: <TResult, TFailure>(effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>) => effect.pipe(Effect.provide(fleetLayer)),
				reviews,
				work: boardWork,
			};
			return yield* use(fixture).pipe(Effect.provide(fleetLayer));
		}),
	);
}
export const prepareWork = Effect.fn("Fleet.prepareWork")(function* (workId: string) {
	const fleet = yield* Fleet;
	return yield* fleet.prepare({
		cwd: "/synthetic",
		preparation: prepared({ ownedPaths: [`src/${workId}.ts`], sourcePaths: [`src/${workId}.ts`] }),
		prompt: `Implement ${workId}`,
		workId,
	});
});
export function finishWorkers(fixture: EngineFixture) {
	for (const [key, value] of fixture.observations) {
		fixture.observations.set(key, { ...value, execution: "completed" });
	}
}
