import { expect } from "@effect/vitest";
import { renderStatus } from "#host/renderStatus.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

const QUESTION = "Which storage should I use?";
const ANSWER = "Use PostgreSQL and preserve the existing repository API.";
const RECORDED = "one waiting (waiting on automation): Answer recorded; applying in the background";
const ANSWER_ARGUMENTS = { argument: [ANSWER], release: ["--release"], stdin: [] };

host.it("status shows a worker's question with the command that answers it", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);

	yield* daemon.reconcile("one");

	const status = yield* daemon.cli(["status"], { selection: "port" });
	expect({ cli: status.stdout.split("\n"), rendered: renderStatus(yield* daemon.status()) }).toMatchObject({
		cli: expect.arrayContaining([expect.stringContaining(QUESTION), `    work-fleet answer one --port ${daemon.port()}`]),
		rendered: expect.stringContaining("work-fleet answer one"),
	});
});

host.it("a blank answer to a worker question is refused as a bad request", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	expect((yield* daemon.reconcile("one")).decision?.worker).toBeDefined();

	const blank = yield* refusal(daemon.answer("one", "  "));

	expect(blank).toMatch(/^bad request: /u);
});

for (const source of ["argument", "stdin", "release"] as const) {
	const file = source === "release" ? "release" : "retry";

	host.it(
		`an answer from ${source} through the CLI records an orchestrator response and an applied receipt`,
		[approvedWork(["one"])],
		function* (daemon) {
			const started = yield* daemon.dispatch("one");
			daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
			const question = (yield* daemon.reconcile("one")).decision?.published?.questionId ?? "missing";

			const cli = yield* daemon.cli(["answer", "one", ...ANSWER_ARGUMENTS[source]], { selection: "port", stdin: source === "stdin" ? ANSWER : "" });

			const applied = yield* daemon.appliedAnswer("one");
			expect({
				cli,
				receipts: daemon.receiptFiles().map((receipt) => daemon.readBoard(receipt)),
				response: daemon.readBoard(`responses/response.fleet-${file}.${question}.md`),
				responses: applied.responses,
			}).toMatchObject({
				cli: { code: 0, stderr: "", stdout: RECORDED },
				receipts: [expect.stringContaining('"disposition":"applied"')],
				response:
					source === "release"
						? expect.stringContaining("author: orchestrator")
						: expect.stringMatching(new RegExp(`author: orchestrator[\\s\\S]*${ANSWER}`, "u")),
				responses: [{ action: source === "release" ? "release" : "continue", boardAcknowledged: true }],
			});
		},
		30_000,
	);
}

for (const source of ["argument", "stdin"] as const) {
	host.it(
		`an answer from ${source} resumes the same worker session with the answer as its prompt and no fleet action`,
		[approvedWork(["one"])],
		function* (daemon) {
			const started = yield* daemon.dispatch("one");
			daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
			const question = (yield* daemon.reconcile("one")).decision?.published?.questionId ?? "missing";
			yield* daemon.cli(["answer", "one", ...ANSWER_ARGUMENTS[source]], { selection: "port", stdin: source === "stdin" ? ANSWER : "" });
			yield* daemon.appliedAnswer("one");

			const resumed = yield* daemon.reconcile("one");

			expect({
				launches: daemon.providerStarts().map(({ operationId }) => operationId),
				prompt: resumed.attempts.at(-1)?.prompt,
				response: daemon.readBoard(`responses/response.fleet-retry.${question}.md`),
				session: resumed.attempts.at(-1)?.receipt?.sessionId,
				step: resumed.step,
			}).toEqual({
				launches: [started.attempts[0]?.operationId],
				prompt: ANSWER,
				response: expect.not.stringContaining("fleet-action"),
				session: started.attempts[0]?.receipt?.sessionId,
				step: "working",
			});
		},
		30_000,
	);
}

host.it("a release answer through the CLI releases the work without another launch", [approvedWork(["one"])], function* (daemon) {
	const started = yield* daemon.dispatch("one");
	daemon.finishTurn(started, `FLEET_QUESTION: ${QUESTION}`);
	yield* daemon.reconcile("one");

	yield* daemon.cli(["answer", "one", "--release"], { selection: "port", stdin: "" });

	const applied = yield* daemon.appliedAnswer("one");
	expect({ launches: daemon.providerStarts().map(({ operationId }) => operationId), step: applied.step }).toEqual({
		launches: [started.attempts[0]?.operationId],
		step: "released",
	});
});
