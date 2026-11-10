import type { Raw as RawSchema } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof RawSchema.Type;

import { Option, Schema } from "effect";

export const RATE_LIMITS_METHOD = "account/rateLimits/updated";

const CodexWindow = Schema.Struct({
	resetsAt: Schema.optional(Schema.NullOr(Schema.Number)),
	usedPercent: Schema.Number,
	windowDurationMins: Schema.optional(Schema.NullOr(Schema.Number)),
});

const RateLimitsNotification = Schema.Struct({
	rateLimits: Schema.Struct({
		primary: Schema.optional(Schema.NullOr(CodexWindow)),
		rateLimitReachedType: Schema.optional(Schema.NullOr(Schema.String)),
		secondary: Schema.optional(Schema.NullOr(CodexWindow)),
	}),
});

type Snapshot = typeof RateLimitsNotification.Type.rateLimits;
type Window = Extract<AgentEvent, { type: "rate.limit" }>["windows"][number];

const decodeRateLimits = Schema.decodeUnknownOption(RateLimitsNotification);

function present<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function windowOf(window: typeof CodexWindow.Type): Window {
	return {
		...(present(window.windowDurationMins) ? { durationMinutes: window.windowDurationMins } : {}),
		...(present(window.resetsAt) ? { resetsAt: window.resetsAt * 1000 } : {}),
		usedPercent: window.usedPercent,
	};
}

function event(raw: RawPayload, snapshot: Snapshot): AgentEvent {
	return {
		raw,
		status: present(snapshot.rateLimitReachedType) ? "rejected" : "unknown",
		type: "rate.limit",
		windows: [snapshot.primary, snapshot.secondary].filter(present).map(windowOf),
	};
}

export function rateLimitEvents(raw: RawPayload, params: unknown): AgentEvent[] {
	return Option.match(decodeRateLimits(params), {
		onNone: () => [{ raw, type: "raw" }],
		onSome: ({ rateLimits }) => [event(raw, rateLimits)],
	});
}
