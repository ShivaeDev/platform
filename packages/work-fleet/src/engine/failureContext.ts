import type { AttentionOwner } from "#attention.ts";
import type { DecisionCode } from "#DecisionCode.ts";
import type { FleetError } from "#errors.ts";

interface FailureContext {
	readonly attentionOwner?: AttentionOwner | undefined;
	readonly code?: DecisionCode | undefined;
	readonly head?: string;
	readonly mainRevision?: string;
}

const contexts = new WeakMap<object, FailureContext>();

export function withFailureContext<E extends FleetError>(error: E, context: FailureContext): E {
	contexts.set(error, context);
	return error;
}

export function failureContext(error: unknown): FailureContext {
	return typeof error === "object" && error !== null ? (contexts.get(error) ?? {}) : {};
}
