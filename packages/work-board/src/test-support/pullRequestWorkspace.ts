import { Clock } from "effect";
import { rawDiagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { pullRequestsFixture } from "#test/pullRequestsFixture.ts";
import { screenStory } from "#test/screenStory.ts";

export function pullRequestWorkspace(live = false) {
	return screenStory.trait("workspace", "Fleet has merge waits, checks, repairs, questions and a review", function* (engine) {
		const fixture = pullRequestsFixture(yield* Clock.currentTimeMillis);
		engine.files = fixture.files;
		engine.path = "/_board/pull-requests";
		engine.options = { fleet: fixture.fleet };
		if (live) {
			engine.sessionFleet = fixture.fleet;
			const daemon = yield* rawDiagnosticsDaemon(
				() => null,
				0,
				() => engine.sessionFleet ?? fixture.fleet,
			);
			engine.sessionFleetPort = daemon.port;
		}
	});
}
