import { Schema } from "effect";
import { eventKinds } from "#events.ts";

const prFields = {
	head: Schema.optionalKey(Schema.String),
	number: Schema.Int,
	title: Schema.String,
};
export const TransitionEvent = Schema.Union([
	Schema.Struct({
		branch: Schema.String,
		event: Schema.Literals(eventKinds.filter((kind) => kind !== "dequeued")),
		...prFields,
	}),
	Schema.Struct({ branch: Schema.String, event: Schema.Literal("dequeued"), ...prFields, reason: Schema.String }),
]);
export type TransitionEvent = typeof TransitionEvent.Type;

const cooldownFields = {
	delayMs: Schema.optionalKey(Schema.Number),
	message: Schema.String,
	nextPollAt: Schema.String,
};
const errorFields = { errorTag: Schema.String, message: Schema.String };

export const HealthEvent = Schema.Union([
	Schema.Struct({ at: Schema.String, event: Schema.Literal("heartbeat"), nextPollAt: Schema.String }),
	Schema.Struct({ at: Schema.String, event: Schema.Literal("cooldown"), ...cooldownFields }),
	Schema.Struct({ at: Schema.String, event: Schema.Literal("error"), ...errorFields }),
	Schema.Struct({ at: Schema.String, event: Schema.Literal("stopped"), reason: Schema.Literals(["completed", "failed", "interrupted"]) }),
]);
export type HealthEvent = typeof HealthEvent.Type;

export const WatchEvent = Schema.Union([TransitionEvent, HealthEvent]);
export type WatchEvent = typeof WatchEvent.Type;

const encode = Schema.encodeSync(Schema.fromJsonString(WatchEvent));
export function encodeJsonLine(event: WatchEvent): string {
	return `${encode(event)}\n`;
}
