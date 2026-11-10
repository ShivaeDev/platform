import { BackendUnavailable, ProtocolFailure, Rejected } from "@shivaedev/agent/failures.ts";

export function describe(detail: unknown): string {
	return detail instanceof Error ? detail.message : String(detail);
}
export function unavailable(detail: unknown) {
	return new BackendUnavailable({ backend: "pi", message: describe(detail) });
}
export function protocolFailure(detail: unknown) {
	return new ProtocolFailure({ backend: "pi", message: describe(detail) });
}
export function rejected(detail: unknown) {
	return new Rejected({ backend: "pi", message: describe(detail) });
}
