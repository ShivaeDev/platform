import { ProtocolFailure } from "@shivaedev/agent/failures.ts";
export function codexFailure(message: string) {
	return new ProtocolFailure({ backend: "codex", message });
}
