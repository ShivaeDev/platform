import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("an answer reaches its waiting worker when another publisher registers the same question", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	const report = `${"Checked the existing storage and transaction boundaries.\n".repeat(200)}\nWhich storage should I use?`;
	daemon.finishTurn(started, `FLEET_QUESTION: ${report}`);
	const waiting = yield* daemon.reconcile("one");
	const published = waiting.decision?.published;
	if (published === undefined) {
		throw new Error("Expected a published worker question");
	}
	daemon.removeBoard(`responses/${published.questionId}.md`);
	const text = "Use PostgreSQL and preserve the transaction boundary.";
	const answer = yield* daemon.pauseAnswerRegistration("one", text);
	yield* answer.entered;
	expect((yield* daemon.publishDecision("one")).value.decision?.published).toEqual(published);
	const registered = daemon.readBoard(`responses/${published.questionId}.md`);
	yield* answer.release;
	const resumed = yield* answer.result;
	expect(resumed.responses).toMatchObject([{ action: "continue", boardAcknowledged: true, questionId: published.questionId }]);
	const continued = yield* daemon.reconcile("one");
	expect(continued.stage).toBe("executing");
	expect(continued.attempts.at(-1)?.prompt).toBe(text);
	expect(continued.attempts.at(-1)?.receipt?.sessionId).toBe(started.attempts.at(-1)?.receipt?.sessionId);
	expect(daemon.readBoard(`responses/${published.questionId}.md`)).toBe(registered);
	expect(daemon.providerCalls().map((call) => call.call)).toEqual(["session", "turn", "turn"]);
});
