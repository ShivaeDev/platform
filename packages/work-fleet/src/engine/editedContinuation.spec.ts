import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { continuationObservation } from "#test/continuationObservation.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const action of ["continue", "answer", "daemon answer"] as const) {
	isolatedEngine.it(`${action} approves an edited task while a worker question waits`, [markdownWork()], function* (fleet) {
		yield* fleet.prepareWork("one");
		const first = yield* fleet.dispatch("one");
		yield* fleet.workerQuestion("one", "Which storage should I use?");
		const waiting = yield* fleet.reconcile("one");
		const decision = waiting.value.decision;
		if (decision?.published === undefined) {
			throw new Error("Missing worker question");
		}
		const edited = fleet.boardBrief().replace("kind: task", "kind: task\ncriteria: [{ id: storage, text: Use durable PostgreSQL transactions. }]");
		fleet.writeBoardWork("one.md", edited);
		const continued =
			action === "continue"
				? yield* fleet.continueWork("one", "Keep working")
				: yield* fleet
						.recordBoardResponse({
							author: "maintainer",
							body: "Use PostgreSQL",
							id: "response.storage",
							question: decision.published.questionId,
							type: "answer",
						})
						.pipe(Effect.flatMap((answer) => (action === "answer" ? fleet.resolve("one", decision.id, answer.id) : fleet.reconcile("one"))));
		expect(continued.value.stage).toBe("executing");
		expect(continued.value.boardContext).toBe(edited);
		expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(first.value.attempts[0]?.receipt?.sessionId);
		expect(continued.value.attempts.at(-1)?.prompt).toContain("Fleet approved an edited brief");
		expect(continued.value.attempts.at(-1)?.prompt).toContain(edited);
		expect(continued.value.attempts.at(-1)?.prompt).toContain(action === "continue" ? "Keep working" : "Use PostgreSQL");
		expect(continued.value.pendingAnswers).toBeUndefined();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("executing");
	});
}

isolatedEngine.it("a task edit approved after a finished turn reaches the next continuation after restart", [markdownWork()], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.workerQuestion("one", "Which storage should I use?");
	const waiting = yield* fleet.reconcile("one");
	const edited = `${fleet.boardBrief()}\nUse durable PostgreSQL transactions.\n`;
	fleet.writeBoardWork("one.md", edited);
	const approved = yield* fleet.dispatch("one");
	expect(approved.value.attempts).toEqual(waiting.value.attempts);
	yield* fleet.restart();
	const continued = yield* fleet.reconcile("one");
	expect(continued.value.attempts.at(-1)?.prompt).toContain(edited);
	expect(continued.value.attempts.at(-1)?.prompt).toContain("Fleet approved an edited brief");
});

const observation = continuationObservation();
isolatedEngine.it("continue retries a daemon save made during provider observation", [markdownWork(), observation.trait], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.workerQuestion("one", "Which storage should I use?");
	const waiting = yield* fleet.reconcile("one");
	observation.pauseNext();
	const continuing = yield* fleet.continueWork("one", "Use PostgreSQL").pipe(Effect.forkChild);
	yield* observation.entered;
	const decision = waiting.value.decision;
	if (decision?.published === undefined) {
		throw new Error("Missing worker question");
	}
	yield* fleet.recordBoardResponse({
		author: "maintainer",
		body: "Wait for the storage decision",
		id: "response.defer",
		question: decision.published.questionId,
		type: "clarify",
	});
	const observed = yield* fleet.reconcile("one");
	expect(observed.version).toBeGreaterThan(waiting.version);
	yield* observation.resume;
	const continued = yield* Fiber.join(continuing);
	expect(continued.value.stage).toBe("executing");
	expect(continued.value.history?.[0]?.blocker).toBe("Human requested clarification: response.defer");
	expect(continued.value.attempts).toEqual([expect.objectContaining({ prompt: "Use PostgreSQL", role: "repair" })]);
});

isolatedEngine.it("unchanged needs-human reconciliation leaves storage untouched", [markdownWork()], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.workerQuestion("one", "Which storage should I use?");
	const question = (yield* fleet.reconcile("one")).value.decision?.published;
	if (question === undefined) {
		throw new Error("Missing worker question");
	}
	for (const author of ["maintainer", "orchestrator"]) {
		yield* fleet.recordBoardResponse({
			author,
			body: `Use ${author}'s storage choice`,
			id: `response.${author}`,
			question: question.questionId,
			type: "answer",
		});
	}
	const waiting = yield* fleet.reconcile("one");
	expect(waiting.value.blocker).toContain("Several Board answers compete");
	for (let pass = 0; pass < 3; pass += 1) {
		fleet.advanceTime(180_000);
		expect(yield* fleet.reconcile("one")).toEqual(waiting);
	}
});
