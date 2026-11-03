import { Schema } from "effect";

export const BackendReference = Schema.Struct({ value: Schema.String, version: Schema.Int });
export const Receipt = Schema.Struct({
	backend: Schema.String,
	operationId: Schema.String,
	reference: BackendReference,
	session: Schema.optional(BackendReference),
});
export type Receipt = typeof Receipt.Type;

export const ExecutionState = Schema.Literals(["accepted", "running", "awaiting-input", "completed", "failed", "interrupted"]);
export const Observation = Schema.Union([
	Schema.Struct({ state: ExecutionState, type: Schema.Literal("known") }),
	Schema.Struct({ reason: Schema.String, type: Schema.Literal("missing") }),
]);
export type Observation = typeof Observation.Type;

export const Reconciliation = Schema.Union([
	Schema.Struct({ receipt: Receipt, type: Schema.Literal("accepted") }),
	Schema.Struct({ evidence: Schema.String, operationId: Schema.String, type: Schema.Literal("not-accepted") }),
	Schema.Struct({ operationId: Schema.String, reason: Schema.String, type: Schema.Literal("uncertain") }),
]);
export type Reconciliation = typeof Reconciliation.Type;

export const TextPart = Schema.Struct({ text: Schema.String, type: Schema.Literal("text") });
export const ImagePart = Schema.Struct({ mediaType: Schema.String, path: Schema.String, type: Schema.Literal("image") });
export const NativePart = Schema.Struct({ kind: Schema.String, payload: Schema.String, type: Schema.Literal("native") });
export const ContentPart = Schema.Union([TextPart, ImagePart, NativePart]);
export type ContentPart = typeof ContentPart.Type;
export const Input = Schema.Struct({ id: Schema.optional(Schema.String), parts: Schema.NonEmptyArray(TextPart) });
export type Input = typeof Input.Type;
export const ImageInput = Schema.Struct({ id: Schema.optional(Schema.String), parts: Schema.NonEmptyArray(Schema.Union([TextPart, ImagePart])) });
export type ImageInput = typeof ImageInput.Type;

export const StartRequest = Schema.Struct({
	cwd: Schema.String,
	effort: Schema.optional(Schema.String),
	input: Input,
	model: Schema.optional(Schema.String),
	operationId: Schema.String,
});
export type StartRequest = typeof StartRequest.Type;
