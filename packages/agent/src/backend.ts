import { Context, type Effect, type Scope, type Stream } from "effect";
import type { ModelChoice } from "#eventData.ts";
import type { RunEvent, Transcript } from "#events.ts";
import type { BackendFailure, ReadFailure } from "#failures.ts";
import type { BackendDescriptor } from "#features.ts";
import type { BackendReference, ImageInput, Input, Observation, Receipt, Reconciliation, StartRequest } from "#run.ts";

export interface RunPort {
	readonly events: (receipt: Receipt) => Stream.Stream<RunEvent, ReadFailure>;
	readonly inspect: (receipt: Receipt) => Effect.Effect<Observation, ReadFailure>;
	readonly reconcile: (operationId: string) => Effect.Effect<Reconciliation, ReadFailure>;
	readonly start: (request: StartRequest) => Effect.Effect<Receipt, BackendFailure, Scope.Scope>;
}

export interface FeatureImplementations {
	readonly imageInput: {
		readonly start: (request: Omit<StartRequest, "input"> & { readonly input: ImageInput }) => Effect.Effect<Receipt, BackendFailure, Scope.Scope>;
	};
	readonly interruption: { readonly interrupt: (receipt: Receipt) => Effect.Effect<void, BackendFailure> };
	readonly models: { readonly list: Effect.Effect<readonly ModelChoice[], ReadFailure> };
	readonly queuedInput: { readonly queue: (receipt: Receipt, input: Input) => Effect.Effect<void, BackendFailure> };
	readonly sessions: {
		readonly resume: (session: typeof BackendReference.Type, request: StartRequest) => Effect.Effect<Receipt, BackendFailure, Scope.Scope>;
	};
	readonly steering: { readonly steer: (receipt: Receipt, input: Input) => Effect.Effect<void, BackendFailure> };
	readonly transcript: { readonly read: (receipt: Receipt) => Effect.Effect<Transcript, ReadFailure> };
}

export type FeatureImplementation<A> =
	| { readonly support: "supported"; readonly implementation: A }
	| { readonly support: "unsupported"; readonly reason: string };

export type ConfiguredFeatures = { readonly [TFeature in keyof FeatureImplementations]: FeatureImplementation<FeatureImplementations[TFeature]> };

export interface ConfiguredBackend extends RunPort {
	readonly backend: string;
	readonly features: ConfiguredFeatures;
}

export class Backend extends Context.Service<Backend, ConfiguredBackend>()("@shivaedev/agent/Backend") {}

export type Agent<TFeature extends keyof FeatureImplementations> = RunPort &
	Pick<FeatureImplementations, TFeature> & { readonly descriptor: BackendDescriptor };
