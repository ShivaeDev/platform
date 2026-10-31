import { expect } from "@effect/vitest";
import * as HttpStatus from "effect/http/HttpStatus";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { WAIT_EXIT } from "./waitOutcome.ts";

const QUESTION = "Which storage should I use?\n\nChoose PostgreSQL or SQLite.";
const BODY = "Use **PostgreSQL**. Preserve the transaction boundary.";

host.it("a worker question stops its work waiting without a result", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");

	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	const stopped = yield* daemon.reconcile("one");

	expect({ published: stopped.decision?.published?.questionId, result: stopped.result ?? "no result", step: stopped.step }).toEqual({
		published: expect.any(String),
		result: "no result",
		step: "waiting",
	});
});

host.it("a worker question's Board link redirects to its answer card", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	const published = (yield* daemon.reconcile("one")).decision?.published;
	const board = yield* daemon.boardHttp();

	const page = yield* daemon.respondRedirect(board, published?.itemId ?? "missing", published?.request ?? "missing");

	expect({ location: page.headers.get("location"), status: page.status }).toEqual({
		location: `/_board/item/${encodeURIComponent(published?.itemId ?? "")}/#answer-card-${encodeURIComponent(published?.request ?? "")}`,
		status: HttpStatus.fromLiteral("Found"),
	});
});

host.it("a worker question appears in its Board preview and the agents inbox", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);

	const published = (yield* daemon.reconcile("one")).decision?.published;

	const board = yield* daemon.boardHttp();
	yield* outcomes([
		[
			"preview",
			() => daemon.question(board, published?.itemId ?? "missing", published?.request ?? "missing"),
			{ context: expect.stringContaining("Which storage should I use?"), reason: expect.stringContaining("Which storage should I use?") },
		],
		["agents inbox", () => daemon.inbox(board), { agents: expect.arrayContaining([expect.objectContaining({ file: published?.sourcePath })]) }],
	]);
});

host.it("wait exits with the waiting-decision code and prints a worker question", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	yield* daemon.reconcile("one");

	const waited = yield* daemon.cli(["wait", "one", "--interval", "0.1", "--timeout", "20"]);

	expect(waited).toEqual({ code: WAIT_EXIT.waitingDecision, stderr: "", stdout: `one waiting (waiting on orchestrator): ${QUESTION}` });
});

host.it("a Board answer to a worker question continues the same thread with the answer as its prompt", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	const decision = (yield* daemon.reconcile("one")).decision;
	const board = yield* daemon.boardHttp();

	const answer = yield* daemon.publishAnswer(board, {
		author: "maintainer",
		body: BODY,
		id: "response.worker.answer",
		question: decision?.published?.questionId ?? "missing",
		type: "answer",
	});
	const resumed = yield* daemon.reconcile("one");

	expect({ resumed, session: resumed.attempts.at(-1)?.receipt?.sessionId }).toMatchObject({
		resumed: {
			attempts: [{ operationId: started.attempts[0]?.operationId }, { prompt: BODY, role: "worker" }],
			responses: [{ action: "continue", boardAcknowledged: true, responseId: answer.id }],
			step: "working",
		},
		session: decision?.worker?.sessionId,
	});
});

host.it("replaying an applied worker answer after a restart starts no worker and submits no turn", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	const decision = (yield* daemon.reconcile("one")).decision;
	const board = yield* daemon.boardHttp();
	const answer = yield* daemon.publishAnswer(board, {
		author: "maintainer",
		body: BODY,
		id: "response.worker.answer",
		question: decision?.published?.questionId ?? "missing",
		type: "answer",
	});
	const resumed = yield* daemon.reconcile("one");
	yield* daemon.stop();
	yield* daemon.start();

	yield* daemon.resolve("one", decision?.id ?? "missing", answer.id);
	const replayed = yield* daemon.reconcile("one");

	expect({
		attempts: replayed.attempts,
		starts: daemon.providerStarts().map(({ operationId }) => operationId),
		turns: daemon
			.providerCalls()
			.filter(({ call }) => call === "turn")
			.map(({ operationId }) => operationId),
	}).toEqual({
		attempts: resumed.attempts,
		starts: [started.attempts[0]?.operationId],
		turns: resumed.attempts.map(({ operationId }) => operationId),
	});
});
