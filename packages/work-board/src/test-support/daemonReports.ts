import { Clock } from "effect";
import { boardStory } from "./boardStory.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";

export function daemonReports(read: (observedAt: number) => unknown) {
	return boardStory.trait("project", "a daemon serves the supplied diagnostics response", function* (engine) {
		const observedAt = yield* Clock.currentTimeMillis;
		const daemon = yield* diagnosticsDaemon(() => read(observedAt));
		engine.fleetPort = daemon.port;
	});
}
