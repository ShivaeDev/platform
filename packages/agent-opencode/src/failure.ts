import { BackendUnavailable, ProtocolFailure } from "@shivaedev/agent/failures.ts";
export function opencodeFailure(detail: unknown): ProtocolFailure {
	return new ProtocolFailure({ backend: "opencode", message: String(detail) });
}
export function unavailable(detail: unknown): BackendUnavailable {
	return new BackendUnavailable({ backend: "opencode", message: String(detail) });
}
