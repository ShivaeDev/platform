import type { DecisionCode } from "#DecisionCode.ts";
import { BoardFailure, FleetFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";

export function failureCode(error: unknown): DecisionCode {
	if (error instanceof FleetFailure) {
		return error.code ?? `fleet-${error.reason}`;
	}
	if (error instanceof SessionFailure) {
		return error.code ?? `session-${error.reason}`;
	}
	if (error instanceof BoardFailure) {
		return error.code ?? "board-failure";
	}
	return "integration-failure";
}
