import { Context, type Effect, Schema } from "effect";
import type { AgentResult, Attempt, Outcome, ProviderRef, PullRequest, WorkSpec } from "./domain.ts";
export class FleetError extends Schema.TaggedError<FleetError>()("FleetError", {
	disposition: Schema.Literals(["uncertain", "repair", "human", "retry"]),
	message: Schema.String,
}) {}
export function failure(message: string, disposition: FleetError["disposition"] = "uncertain") {
	return new FleetError({ disposition, message });
}
export type Observation =
	| {
			readonly status: "pending";
			readonly ref: ProviderRef;
	  }
	| {
			readonly status: "completed";
			readonly ref: ProviderRef;
			readonly result: AgentResult;
	  }
	| {
			readonly status: "failed";
			readonly ref: ProviderRef;
			readonly message: string;
	  }
	| {
			readonly status: "unknown";
			readonly message: string;
	  };
export interface AgentRequest {
	readonly attempt: Attempt;
	readonly outcome: Outcome | null;
	readonly work: WorkSpec;
}
export class Agent extends Context.Service<
	Agent,
	{
		readonly backendId: string;
		readonly launch: (
			request: AgentRequest,
			acknowledge: (ref: ProviderRef) => Effect.Effect<void, FleetError>,
		) => Effect.Effect<Observation, FleetError>;
		readonly observe: (request: AgentRequest) => Effect.Effect<Observation, FleetError>;
	}
>()("@shivaedev/work-fleet/Agent") {}
export class ChangeHost extends Context.Service<
	ChangeHost,
	{
		readonly backendId: string;
		readonly publish: (
			work: WorkSpec,
			revision: string,
			previous?: Extract<
				Outcome,
				{
					kind: "pull-request";
				}
			>,
		) => Effect.Effect<
			Extract<
				Outcome,
				{
					kind: "pull-request";
				}
			>,
			FleetError
		>;
		readonly findPublished: (
			work: WorkSpec,
			revision: string,
		) => Effect.Effect<
			Extract<
				Outcome,
				{
					kind: "pull-request";
				}
			> | null,
			FleetError
		>;
		readonly verifyChange: (work: WorkSpec, revision: string) => Effect.Effect<void, FleetError>;
		readonly verifyNoChange: (work: WorkSpec, revision: string) => Effect.Effect<void, FleetError>;
		readonly observe: (work: WorkSpec, number: number) => Effect.Effect<PullRequest, FleetError>;
		readonly merge: (work: WorkSpec, number: number, revision: string) => Effect.Effect<void, FleetError>;
	}
>()("@shivaedev/work-fleet/ChangeHost") {}
