import { holdErrorReport } from "#test/runtime/errorReporting.ts";
import { runtime } from "#test/runtime/kit.ts";

export function pendingErrorReport(interruptible = true) {
	return runtime.trait(
		"client",
		`the application's onError waits for permission to finish${interruptible ? "" : " without interruption"}`,
		(engine) => holdErrorReport(engine, interruptible),
	);
}
