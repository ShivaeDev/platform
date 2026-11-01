import { Deferred, Effect } from "effect";
import { admittedMcp } from "./mcp.ts";

export function pendingAdmission(name: string) {
	return admittedMcp.trait("connections", `${name}'s next admission check waits for its provider`, function* (engine) {
		engine.admission.paused.add(name);
		yield* Effect.addFinalizer(() => Deferred.succeed(engine.admission.resume, undefined));
	});
}
