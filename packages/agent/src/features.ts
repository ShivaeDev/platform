import { Schema } from "effect";

export const Feature = Schema.Literals(["sessions", "queuedInput", "steering", "interruption", "transcript", "imageInput", "models"]);
export type Feature = typeof Feature.Type;

export const FeatureDescriptor = Schema.Union([
	Schema.Struct({ support: Schema.Literal("supported") }),
	Schema.Struct({ reason: Schema.String, support: Schema.Literal("unsupported") }),
]);
export type FeatureDescriptor = typeof FeatureDescriptor.Type;

export const BackendDescriptor = Schema.Struct({
	backend: Schema.String,
	features: Schema.Struct({
		imageInput: FeatureDescriptor,
		interruption: FeatureDescriptor,
		models: FeatureDescriptor,
		queuedInput: FeatureDescriptor,
		sessions: FeatureDescriptor,
		steering: FeatureDescriptor,
		transcript: FeatureDescriptor,
	}),
});
export type BackendDescriptor = typeof BackendDescriptor.Type;
