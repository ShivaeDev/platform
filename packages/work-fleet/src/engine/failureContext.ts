import type { AttentionOwner } from "#attention.ts";
import type { DecisionCode } from "#DecisionCode.ts";

interface FailureContext {
	readonly attentionOwner?: AttentionOwner | undefined;
	readonly code?: DecisionCode | undefined;
	readonly expectedWait?: boolean;
	readonly head?: string;
	readonly mainRevision?: string;
	readonly retryAt?: number;
	readonly retryable?: boolean;
}

const contexts = new WeakMap<object, FailureContext>();

export function withFailureContext<E extends object>(error: E, context: FailureContext): E {
	contexts.set(error, context);
	return error;
}

export function failureContext(error: unknown): FailureContext {
	return typeof error === "object" && error !== null ? (contexts.get(error) ?? {}) : {};
}
