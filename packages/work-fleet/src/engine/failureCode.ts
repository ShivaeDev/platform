import type { DecisionCode } from "#DecisionCode.ts";
import { failureContext } from "#engine/failureContext.ts";
import { type FleetError, isFleetError } from "#errors.ts";
import { BoardFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";

const platformCodes: Readonly<Record<FleetError["_tag"], DecisionCode>> = {
	BadRequest: "fleet-invalid",
	Conflict: "fleet-stale",
	Forbidden: "fleet-denied",
	NotFound: "fleet-missing",
	ServiceUnavailable: "fleet-integration",
};

export function failureCode(error: unknown): DecisionCode {
	const code = failureContext(error).code;
	if (code !== undefined) {
		return code;
	}
	if (isFleetError(error)) {
		return platformCodes[error._tag];
	}
	if (error instanceof SessionFailure) {
		return error.code ?? `session-${error.reason}`;
	}
	if (error instanceof BoardFailure) {
		return error.code ?? "board-failure";
	}
	return "integration-failure";
}
