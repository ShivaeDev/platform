import { Effect, type Layer } from "effect";
import type { BoardDecisionAcknowledgement } from "#board/schema.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardGateway, BoardWork, FleetConfiguration, Priority } from "#policy.ts";
import type { ForeignReservation } from "#storage/model.ts";
import { createEngine } from "#test/createEngine.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineProvider } from "#test/engineProvider.ts";
import { prepared } from "#test/preparation.ts";

export interface EngineFixture<TBoardError = never> extends Omit<EngineProvider, "transport"> {
	readonly acknowledgementAttempts: readonly BoardDecisionAcknowledgement[];
	readonly acknowledgements: readonly BoardDecisionAcknowledgement[];
	readonly acknowledgeTurn: (operationId: string, receipt: { readonly sessionId: string; readonly turnId: string }) => Effect.Effect<void, unknown>;
	readonly approveWork: (workId: string, revision: string) => void;
	readonly areas: (workId: string, areas: readonly string[]) => void;
	readonly boardStatus: (workId: string, status: string) => void;
	readonly decisions: readonly string[];
	readonly dependencies: (workId: string, references: readonly string[]) => void;
	readonly editWork: (workId: string, revision: string) => void;
	readonly foreign: (owner: string, areas?: readonly string[]) => Effect.Effect<void, unknown>;
	readonly foreignReservations: () => Effect.Effect<readonly ForeignReservation[], unknown>;
	readonly merged: readonly string[];
	readonly occupy: (owner: string) => Effect.Effect<void, unknown>;
	readonly priority: (workId: string, priority: Priority) => void;
	readonly replaceRecord: (value: FleetRecord) => Effect.Effect<void, unknown>;
	readonly respond: (decisionId: string, action: "retry" | "release" | "wait", type?: "answer" | "clarify" | "not_now") => string;
	readonly restart: <TResult, TFailure>(
		effect: Effect.Effect<TResult, TFailure, typeof Fleet.Identifier>,
		configure?: (policy: FleetConfiguration) => FleetConfiguration,
	) => Effect.Effect<TResult, TFailure | TBoardError>;
	readonly reviews: readonly string[];
	readonly sessionName: (operationId: string) => Effect.Effect<string, unknown>;
	readonly unavailableWork: (workId: string, unavailable: boolean) => void;
	readonly upgradeAttention: Effect.Effect<void, unknown>;
	readonly upgradeDecisionCodes: Effect.Effect<void, unknown>;
	readonly vacate: (owner: string) => Effect.Effect<void, unknown>;
	readonly work: (id: string) => BoardWork;
}
export const withEngine = Effect.fn("FleetFixture.withEngine")(function* <A, E, TBoardError = never>(
	options: EngineOptions,
	use: (fixture: EngineFixture<TBoardError>) => Effect.Effect<A, E, typeof Fleet.Identifier>,
	boardOverride?: Layer.Layer<BoardGateway, TBoardError>,
) {
	const { fixture, fleetLayer } = yield* createEngine(options, boardOverride);
	return yield* use(fixture).pipe(Effect.provide(fleetLayer));
});

export const prepareWork = Effect.fn("Fleet.prepareWork")(function* (workId: string) {
	const fleet = yield* Fleet;
	return yield* fleet.prepare({
		cwd: "/synthetic",
		preparation: prepared({ ownedPaths: [`src/${workId}.ts`], sourcePaths: [`src/${workId}.ts`] }),
		prompt: `Implement ${workId}`,
		workId,
	});
});
export function finishWorkers(fixture: Pick<EngineFixture, "observations">) {
	for (const [key, value] of fixture.observations) {
		fixture.observations.set(key, { ...value, execution: "completed" });
	}
}
