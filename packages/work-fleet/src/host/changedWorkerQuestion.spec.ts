import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerApplicationInFlight } from "#test/answerApplicationInFlight.ts";
import { approvedWork, host } from "#test/hostStory.ts";

const QUESTION = "Which migration should contain the storage change?";

host.it(
	"a refused in-flight answer shows the replacement worker question and a new answer resumes the same session",
	[approvedWork(["one"]), answerApplicationInFlight()],
	function* (daemon) {
		const worker = yield* daemon.dispatch("one");
		const session = worker.attempts[0]?.receipt;
		daemon.finishTurn(worker, "FLEET_QUESTION: Which storage should I use?");
		const waiting = yield* daemon.reconcile("one");
		if (waiting.decision === undefined || session === undefined) {
			return yield* Effect.die("Expected a worker question");
		}
		yield* daemon.recordAnswer(waiting.decision, "retry", "Use PostgreSQL.");
		yield* daemon.beginAnswerApplication("one");
		const continued = yield* daemon.continue("one", "Ask which migration should contain the change.");
		daemon.finishTurn(continued, `FLEET_QUESTION: ${QUESTION}`);
		yield* daemon.reconcile("one");
		expect((yield* daemon.cli(["status", "one"])).stdout).toContain(QUESTION);

		yield* daemon.finishAnswerApplication();

		yield* outcomes([
			[
				"status shows the refused answer",
				() => daemon.cli(["status", "one"]),
				{ code: 0, stdout: expect.stringContaining("Answer failed: Decision changed") },
			],
			["status shows the replacement question", () => daemon.cli(["status", "one"]), { code: 0, stdout: expect.stringContaining(QUESTION) }],
		]);

		yield* daemon.answer("one", "Use the next migration.");

		yield* outcomes([
			[
				"provider receives the new answer on the original session",
				() => Effect.sync(() => daemon.providerTurns().at(-1)),
				{ prompt: expect.stringContaining("Use the next migration."), sessionId: session.sessionId },
			],
			[
				"status follows active work",
				() => daemon.status(),
				{ active: [{ stage: "working", workId: "one" }], waiting: { automation: [], maintainer: [], orchestrator: [] } },
			],
			["status has no answer failure", () => daemon.cli(["status", "one"]), { code: 0, stdout: expect.not.stringContaining("Answer failed:") }],
		]);
	},
);

host.it("a late answer failure keeps continued work active", [approvedWork(["one"]), answerApplicationInFlight()], function* (daemon) {
	const worker = yield* daemon.dispatch("one");
	daemon.finishTurn(worker, "FLEET_QUESTION: Which storage should I use?");
	const waiting = yield* daemon.reconcile("one");
	if (waiting.decision === undefined) {
		return yield* Effect.die("Expected a worker question");
	}
	yield* daemon.recordAnswer(waiting.decision, "retry", "Use PostgreSQL.");
	yield* daemon.beginAnswerApplication("one");
	yield* daemon.continue("one", "Use PostgreSQL and continue the work.");

	yield* daemon.finishAnswerApplication();

	const status = yield* daemon.cli(["status", "one"]);
	expect(status).toMatchObject({ code: 0, stdout: expect.stringContaining("Active (1)") });
});
