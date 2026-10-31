import { expect } from "@effect/vitest";
import { host } from "#test/hostStory.ts";
import { restartCloudTrait } from "#test/restartCloudTrait.ts";

host.it(
	"restarting the Board mid-dispatch leaves the daemon's accepted worker to publish exactly one report",
	[restartCloudTrait("dispatch")],
	function* (daemon) {
		const board = yield* daemon.spawnBoardProcess();
		yield* board.ready;
		const process = yield* daemon.spawnRestartHost();
		const client = yield* daemon.processClient(yield* process.ready);
		yield* daemon.awaitAcceptedTurn();
		const submitting = yield* client("fleet.get", { workId: "one" });
		expect(submitting.attempts[0]?.receipt).toBeUndefined();

		yield* board.kill;
		const replacement = yield* daemon.spawnBoardProcess();
		yield* replacement.ready;
		daemon.acknowledgeRestartTurn();
		daemon.finishRestartTurn();
		const completed = yield* daemon.awaitProcessRecord(client, "one", (record) => record.stage === "done");
		yield* client("fleet.reconcile", { workId: "one" });

		expect(completed.attempts.map(({ operationId }) => operationId)).toEqual(submitting.attempts.map(({ operationId }) => operationId));
		expect(daemon.restartMutations().map(({ method }) => method)).toEqual(["thread/start", "turn/start"]);
		expect(daemon.boardFiles("responses").filter((file) => file.startsWith("fleet-report."))).toEqual([`${completed.report?.itemId}.md`]);
	},
	40_000,
);
