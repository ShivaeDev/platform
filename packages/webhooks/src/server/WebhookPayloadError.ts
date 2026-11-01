import { Data, type Schema } from "effect";

export class WebhookPayloadError extends Data.TaggedError("WebhookPayloadError")<{
	readonly cause: Schema.SchemaError;
}> {}
