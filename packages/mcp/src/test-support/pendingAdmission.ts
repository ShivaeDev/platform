import { Effect } from "effect";
import { admittedMcp } from "./mcp.ts";

export function pendingAdmission(name: string) {
	return admittedMcp.trait("connections", `${name}'s next admission check waits for its provider`, (engine) =>
		Effect.sync(() => engine.admission.paused.add(name)),
	);
}
