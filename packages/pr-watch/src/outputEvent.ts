import { Schema } from "effect";
import { eventKinds } from "#events.ts";

const prFields = {
	branch: Schema.String,
	head: Schema.optionalKey(Schema.String),
	number: Schema.Int,
	title: Schema.String,
};
export const TransitionEvent = Schema.Union([
	Schema.Struct({
		...prFields,
		event: Schema.Literals(eventKinds.filter((kind) => kind !== "dequeued")),
	}),
	Schema.Struct({ ...prFields, event: Schema.Literal("dequeued"), reason: Schema.String }),
]);
export type TransitionEvent = typeof TransitionEvent.Type;

export const HealthEvent = Schema.Union([
	Schema.Struct({ at: Schema.String, event: Schema.Literal("heartbeat"), nextPollAt: Schema.String }),
	Schema.Struct({
		at: Schema.String,
		delayMs: Schema.optionalKey(Schema.Number),
		event: Schema.Literal("cooldown"),
		message: Schema.String,
		nextPollAt: Schema.String,
	}),
	Schema.Struct({ at: Schema.String, errorTag: Schema.String, event: Schema.Literal("error"), message: Schema.String }),
	Schema.Struct({ at: Schema.String, event: Schema.Literal("stopped"), reason: Schema.Literals(["completed", "failed", "interrupted"]) }),
]);
export type HealthEvent = typeof HealthEvent.Type;

export const WatchEvent = Schema.Union([TransitionEvent, HealthEvent]);
export type WatchEvent = typeof WatchEvent.Type;

const encode = Schema.encodeSync(Schema.fromJsonString(WatchEvent));
export function encodeJsonLine(event: WatchEvent): string {
	return `${encode(event)}\n`;
}
