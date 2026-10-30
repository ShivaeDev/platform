import { expect } from "@effect/vitest";
import { host } from "#test/hostStory.ts";
import { restartCloudTrait } from "#test/restartCloudTrait.ts";

for (const boundary of ["dispatch", "answer", "publication"] as const) {
	const answer = boundary === "answer";
	host.it(
		`SIGKILL mid-${boundary} resumes the same work to one completed report`,
		[restartCloudTrait(boundary)],
		function* (daemon) {
			const first = yield* daemon.spawnRestartHost(boundary === "publication");
			const client = yield* daemon.processClient(yield* first.ready);
			if (boundary === "dispatch") {
				yield* daemon.awaitAcceptedTurn();
			}
			const worker = yield* daemon.awaitProcessRecord(client, "one", (record) =>
				answer ? record.decision?.worker !== undefined : record.attempts.length === 1,
			);
			if (answer) {
				yield* client("daemon.answer", { text: "Use PostgreSQL.", workId: "one" });
				yield* daemon.awaitAcceptedTurn();
			} else if (boundary === "publication") {
				daemon.finishRestartTurn();
				yield* first.published;
			}

			yield* first.kill;
			const restarted = yield* daemon.spawnRestartHost();
			const peer = yield* daemon.processClient(yield* restarted.ready);
			if (answer) {
				const resumed = yield* daemon.awaitProcessRecord(peer, "one", (record) => record.attempts.at(-1)?.receipt?.turnId === "restart-turn-2");
				expect(resumed.attempts.at(-1)?.prompt).toContain("Use PostgreSQL.");
			}
			if (boundary !== "publication") {
				daemon.finishRestartTurn();
			}
			const completed = yield* daemon.awaitProcessRecord(peer, "one", (record) => record.stage === "done");
			yield* peer("fleet.reconcile", { workId: "one" });

			expect(completed.attempts[0]?.operationId).toBe(worker.attempts[0]?.operationId);
			expect(completed.attempts[0]?.receipt).toEqual({ sessionId: "restart-thread", turnId: "restart-turn-1" });
			expect(daemon.boardFiles("responses").filter((file) => file.startsWith("fleet-report."))).toEqual([`${completed.report?.itemId}.md`]);
			expect(daemon.restartMutations().map(({ method }) => method)).toEqual(
				answer ? ["thread/start", "turn/start", "turn/start"] : ["thread/start", "turn/start"],
			);
			if (answer) {
				expect(completed.responses?.map(({ action, boardAcknowledged }) => ({ action, boardAcknowledged }))).toEqual([
					{ action: "continue", boardAcknowledged: true },
				]);
			}
		},
		40_000,
	);
}
