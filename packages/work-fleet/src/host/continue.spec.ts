import { expect } from "@effect/vitest";
import { WAIT_EXIT } from "#host/wait.ts";
import { continuedCloud } from "#test/continuedCloud.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

host.it(
	"the continue CLI sends its stdin message on the existing Cloud thread and wait follows the new output",
	[boardWork({ "one.md": task("one", "approved") }), continuedCloud],
	function* (daemon) {
		daemon.initializeRepository();
		const first = yield* daemon.approve("one");
		daemon.originalCloudTurn(first.value.attempts[0]?.receipt?.turnId ?? "missing");
		daemon.finishTurn(first.value);
		yield* daemon.reconcile("one");
		const message = "Fix the checks.\nKeep the existing PR.\n";
		yield* daemon.stop();
		daemon.useCloudProvider();
		yield* daemon.start();
		const run = yield* daemon.cli(["continue", "one"], { stdin: message });
		expect(run).toEqual({ code: 0, stderr: "", stdout: "one working" });
		expect(yield* daemon.get("one")).toMatchObject({
			attempts: [{ prompt: message, sessionId: first.value.attempts[0]?.receipt?.sessionId }],
			step: "working",
		});
		const published = yield* daemon.awaitBoardSource("fleet/status.md", (source) => source.includes("Stage: working"));
		expect(published).toContain("## Active\n\n### one\n");
		const health = yield* daemon.awaitBoardSource("fleet/health.json", (source) => JSON.parse(source).running === 1);
		expect(JSON.parse(health)).toMatchObject({
			running: 1,
			waiting: { automation: 0, maintainer: 0, orchestrator: 0 },
		});
		expect(daemon.continuationRequests().find((request) => request.method === "turn/start")?.params).toMatchObject({
			input: [{ text: message, type: "text" }],
			threadId: first.value.attempts[0]?.receipt?.sessionId,
		});
		expect(daemon.continuationRequests().filter((request) => request.method === "turn/start")).toHaveLength(1);
		expect(daemon.continuationRequests().filter((request) => request.method === "thread/start")).toHaveLength(0);
		yield* daemon.waitForRecord("one", (record) => record.attempts[0]?.receipt?.turnId === "continued-turn");
		const status = yield* daemon.status();
		expect(status.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
		expect(status.active[0]?.sessions[0]?.turnId).toBe("continued-turn");
		expect(yield* daemon.wait("one", 300)).toEqual({
			code: WAIT_EXIT.timeout,
			summary: "one still working: wait timed out",
		});
		daemon.finishContinuedCloudTurn();
		const completed = yield* daemon.reconcile("one");
		expect(completed.attempts[0]?.output).toBe("Repaired result");
		expect(completed.history?.[0]?.attempts[0]?.output).not.toBe("Repaired result");
		expect((yield* daemon.wait("one")).code).toBe(WAIT_EXIT.waitingDecision);
	},
);
