import { Context, type Effect, Schema } from "effect";
import type { MainObservation, Preparation } from "#preparation/schema.ts";
import type { SessionObservation } from "#session/schema.ts";
import { SessionReceipt } from "#session/schema.ts";

export const BoardWork = Schema.Struct({
	context: Schema.String,
	dependsOn: Schema.Array(Schema.String),
	revision: Schema.String,
	sourcePath: Schema.String,
	workId: Schema.String,
});
export type BoardWork = typeof BoardWork.Type;
export const Decision = Schema.Struct({
	id: Schema.String,
	links: Schema.Array(Schema.String),
	reason: Schema.String,
	recommendation: Schema.String,
});
export type Decision = typeof Decision.Type;
export class FleetFailure extends Schema.TaggedError<FleetFailure>()("FleetFailure", {
	message: Schema.String,
	reason: Schema.Literals(["missing", "stale", "denied", "integration", "invalid"]),
}) {}
export class BoardFailure extends Schema.TaggedError<BoardFailure>()("BoardFailure", { message: Schema.String }) {}
export class BoardGateway extends Context.Service<
	BoardGateway,
	{
		readonly get: (workId: string) => Effect.Effect<BoardWork, BoardFailure>;
		readonly decision: (workId: string, decision: Decision) => Effect.Effect<string, BoardFailure>;
	}
>()("@shivaedev/work-fleet/BoardGateway") {}
export const ChangeResult = Schema.Struct({
	head: Schema.String,
	kind: Schema.Literal("change"),
	paths: Schema.Array(Schema.String),
	pr: Schema.String,
});
export const NoChangeResult = Schema.Struct({ evidence: Schema.Array(Schema.String), head: Schema.String, kind: Schema.Literal("no-change") });
export const WorkResult = Schema.Union([ChangeResult, NoChangeResult]);
export type WorkResult = typeof WorkResult.Type;
export const Review = Schema.Struct({
	evidence: Schema.Array(Schema.String),
	head: Schema.String,
	receipt: SessionReceipt,
	repairPrompt: Schema.String,
	verdict: Schema.Literals(["approved", "changes"]),
});
export type Review = typeof Review.Type;
export const Checks = Schema.Struct({
	evidence: Schema.Array(Schema.String),
	head: Schema.String,
	passed: Schema.Boolean,
	repairPrompt: Schema.optional(Schema.String),
});
export type Checks = typeof Checks.Type;
export const Delivery = Schema.Struct({ head: Schema.String, revision: Schema.String, url: Schema.String });
export type Delivery = typeof Delivery.Type;
export interface FleetConfiguration {
	readonly approved: Readonly<Record<string, string>>;
	readonly deliveryBacklog?: number;
	readonly executionConcurrency?: number;
	readonly now: () => number;
	readonly operationId: () => string;
	readonly quota: { readonly available?: number; readonly observedAt: number; readonly expiresAt: number };
	readonly refreshQuota?: () => Effect.Effect<FleetConfiguration["quota"], FleetFailure>;
}
export class FleetPolicy extends Context.Service<FleetPolicy, FleetConfiguration>()("@shivaedev/work-fleet/FleetPolicy") {}
export class FleetIntegrations extends Context.Service<
	FleetIntegrations,
	{
		readonly main: (preparation: Preparation) => Effect.Effect<MainObservation, FleetFailure>;
		readonly result: (work: BoardWork, observation: SessionObservation) => Effect.Effect<WorkResult, FleetFailure>;
		readonly review: (work: BoardWork, result: WorkResult, operationId: string) => Effect.Effect<Review, FleetFailure>;
		readonly reconcileReview: (work: BoardWork, result: WorkResult, operationId: string) => Effect.Effect<Review, FleetFailure>;
		readonly checks: (work: BoardWork, result: WorkResult) => Effect.Effect<Checks, FleetFailure>;
		readonly authorize: (work: BoardWork, result: typeof ChangeResult.Type) => Effect.Effect<boolean, FleetFailure>;
		readonly delivery: (result: typeof ChangeResult.Type) => Effect.Effect<Delivery | undefined, FleetFailure>;
		readonly merge: (work: BoardWork, result: typeof ChangeResult.Type) => Effect.Effect<Delivery, FleetFailure>;
	}
>()("@shivaedev/work-fleet/FleetIntegrations") {}
