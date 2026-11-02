import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"current actionable waits print once across a daemon restart and later waits still arrive",
	[approvedWork(["one", "two"])],
	function* (daemon) {
		const first = yield* daemon.dispatch("one");
		daemon.finishTurn(first, "FLEET_QUESTION: First question");
		yield* daemon.reconcile("one");
		yield* daemon.watchDefault({ follow: true, json: true, prEvents: false });
		yield* daemon.awaitEvent("waiting-on-orchestrator");
		yield* daemon.stop();
		yield* daemon.start();
		const second = yield* daemon.dispatch("two");
		daemon.finishTurn(second, "FLEET_QUESTION: Second question");
		yield* daemon.reconcile("two");
		yield* daemon.awaitOutput("events", '"reason":"Second question"');

		expect(daemon.eventLines()).toEqual([
			{ kind: "waiting-on-orchestrator", reason: "First question", workId: "one" },
			{ kind: "waiting-on-orchestrator", reason: "Second question", workId: "two" },
		]);
	},
);
