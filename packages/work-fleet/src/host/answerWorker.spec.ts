import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { renderStatus } from "#host/renderStatus.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const source of ["argument", "stdin", "release"] as const) {
	host.it(
		`answer from ${source} records a worker response and an applied receipt`,
		[approvedWork(["one"])],
		function* (daemon) {
			const started = yield* daemon.dispatch("one");
			daemon.finishTurn(started, "FLEET_QUESTION: Which storage should I use?");
			const waiting = yield* daemon.reconcile("one");
			expect(waiting.decision?.worker).toBeDefined();
			if (source === "argument") {
				const status = yield* daemon.cli(["status"], { selection: "port" });
				expect(status.stdout).toContain("Which storage should I use?");
				expect(status.stdout.split("\n")).toContain(`    work-fleet answer one --port ${daemon.port()}`);
			}
			expect(renderStatus(yield* daemon.status())).toContain("work-fleet answer one");
			expect(yield* daemon.answer("one", "  ").pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
			const answer = "Use PostgreSQL and preserve the existing repository API.";
			const argumentsBySource = { argument: [answer], release: ["--release"], stdin: [] };
			expect(
				yield* daemon.cli(["answer", "one", ...argumentsBySource[source]], { selection: "port", stdin: source === "stdin" ? answer : "" }),
			).toEqual({
				code: 0,
				stderr: "",
				stdout: "one waiting (waiting on automation): Answer recorded; applying in the background",
			});
			const queued = yield* daemon.appliedAnswer("one");
			expect(queued.responses).toMatchObject([{ action: source === "release" ? "release" : "continue", boardAcknowledged: true }]);
			const published = waiting.decision?.published;
			if (published === undefined) {
				throw new Error("Expected a worker question");
			}
			const response = daemon.readBoard(`responses/response.fleet-${source === "release" ? "release" : "retry"}.${published.questionId}.md`);
			if (source !== "release") {
				expect(response).toContain(answer);
				expect(response).not.toContain("fleet-action");
			}
			expect(response).toContain("author: orchestrator");
			const receipts = daemon.receiptFiles();
			expect(receipts.map((file) => daemon.readBoard(file))).toEqual([expect.stringContaining('"disposition":"applied"')]);
			if (source === "release") {
				expect(queued.step).toBe("released");
			} else {
				const resumed = yield* daemon.reconcile("one");
				expect(resumed.step).toBe("working");
				expect(resumed.attempts.at(-1)?.receipt?.sessionId).toBe(started.attempts[0]?.receipt?.sessionId);
				expect(resumed.attempts.at(-1)?.prompt).toBe(answer);
			}
			expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual([started.attempts[0]?.operationId]);
		},
		30_000,
	);
}
