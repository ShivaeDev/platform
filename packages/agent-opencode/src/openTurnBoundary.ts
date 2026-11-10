import type { Raw } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof Raw.Type;
type SessionState = "running" | "awaiting-input";

import { Option, Schema } from "effect";
import { rawEvent } from "#mapping.ts";
import { SessionErrorProperties, SessionStatusProperties } from "#protocol.ts";

const decodeStatus = Schema.decodeUnknownOption(SessionStatusProperties);
const decodeError = Schema.decodeUnknownOption(SessionErrorProperties);
function stateOf(type: string): SessionState | undefined {
	if (type === "idle") {
		return "awaiting-input";
	}
	return type === "busy" || type === "retry" ? "running" : undefined;
}
const ABORTED = "MessageAbortedError";
interface TurnBoundary {
	readonly errored: (raw: RawPayload, properties: unknown) => AgentEvent[];
	readonly idled: (raw: RawPayload) => AgentEvent[];
	readonly status: (raw: RawPayload, properties: unknown) => AgentEvent[];
}
export function openTurnBoundary(): TurnBoundary {
	let running = false;
	let outcome: "failed" | "interrupted" | undefined;
	return {
		errored: (raw, properties) => {
			outcome = Option.match(decodeError(properties), {
				onNone: () => "failed" as const,
				onSome: ({ error }) => (error?.name === ABORTED ? "interrupted" : "failed"),
			});
			return rawEvent(raw);
		},
		idled: (raw) => {
			if (!running) {
				return [];
			}
			running = false;
			const status = outcome ?? "completed";
			outcome = undefined;
			return [{ raw, state: status, type: "execution" }];
		},
		status: (raw, properties) =>
			Option.match(decodeStatus(properties), {
				onNone: () => rawEvent(raw),
				onSome: ({ status }) => {
					const state = stateOf(status.type);
					if (state === undefined) {
						return rawEvent(raw);
					}
					running = running || state === "running";
					return [{ raw, state, type: "execution" }];
				},
			}),
	};
}
