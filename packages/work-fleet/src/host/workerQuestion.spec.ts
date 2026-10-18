import { expect } from "@effect/vitest";
import { WAIT_EXIT } from "#host/wait.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"worker questions appear on Board, wait exits needs-human, and an answer continues the thread once across restart",
	[approvedWork(["one"])],
	function* (daemon) {
		const started = yield* daemon.dispatch("one");
		const question = "Which storage should I use?\n\nChoose PostgreSQL or SQLite.";
		daemon.finishTurn(started, `FLEET_QUESTION: ${question}`);
		const stopped = yield* daemon.reconcile("one");
		expect(stopped.stage).toBe("needs-human");
		expect(stopped.result).toBeUndefined();
		const decision = stopped.decision;
		const published = decision?.published;
		if (decision === undefined || published === undefined) {
			throw new Error("Expected a published worker question");
		}
		const board = yield* daemon.boardHttp();
		const page = yield* daemon.respondRedirect(board, published.itemId, published.request);
		expect(page.status).toBe(302);
		expect(page.headers.get("location")).toBe(
			`/_board/item/${encodeURIComponent(published.itemId)}/#answer-card-${encodeURIComponent(published.request)}`,
		);
		const preview = yield* daemon.question(board, published.itemId, published.request);
		expect(preview.reason).toContain("Which storage should I use?");
		expect(preview.context).toContain("Which storage should I use?");
		expect((yield* daemon.inbox(board)).agents).toEqual(expect.arrayContaining([expect.objectContaining({ file: published.sourcePath })]));
		expect(yield* daemon.cli(["wait", "one", "--interval", "0.1", "--timeout", "20"])).toEqual({
			code: WAIT_EXIT.waitingDecision,
			stderr: "",
			stdout: `one needs-human (waiting on orchestrator): ${question}`,
		});
		const body = "Use **PostgreSQL**. Preserve the transaction boundary.";
		const answer = yield* daemon.publishAnswer(board, {
			author: "maintainer",
			body,
			id: "response.worker.answer",
			question: published.questionId,
			type: "answer",
		});
		const resumed = yield* daemon.reconcile("one");
		expect(resumed.stage).toBe("executing");
		expect(resumed.attempts).toHaveLength(2);
		expect(resumed.responses).toMatchObject([{ action: "continue", boardAcknowledged: true, responseId: answer.id }]);
		expect(resumed.attempts.at(-1)?.receipt?.sessionId).toBe(decision.worker?.sessionId);
		expect(resumed.attempts.at(-1)?.prompt).toBe(body);
		yield* daemon.stop();
		yield* daemon.start();
		yield* daemon.resolve("one", decision.id, answer.id);
		const replayed = yield* daemon.reconcile("one");
		expect(replayed.attempts).toEqual(resumed.attempts);
		expect(daemon.providerStarts()).toHaveLength(1);
		expect(daemon.providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
	},
);
