import { expect } from "@effect/vitest";
import type { BoardDecision } from "#board/schema.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"bulk CLI release closes changed done and deferred decisions and records one response per question",
	[approvedWork(["one", "two"])],
	function* (daemon) {
		daemon.initializeRepository();
		const decisions: BoardDecision[] = [];
		for (const [id, status] of [
			["one", "done"],
			["two", "deferred"],
		] as const) {
			const started = yield* daemon.dispatch(id);
			expect((yield* daemon.cli(["release", id])).code).toBe(1);
			let published: BoardDecision | undefined;
			if (id === "one") {
				const waiting = yield* daemon.workerQuestion(id);
				yield* daemon.deferWorker(waiting.decision);
				published = waiting.published;
			} else {
				daemon.finishTurn(started);
				published = (yield* daemon.reconcile(id)).decision?.published;
			}
			if (published === undefined) {
				throw new Error("Missing guided decision");
			}
			decisions.push(published);
			daemon.writeBoard(`${id}.md`, `---\nid: ${id}\nkind: task\nstatus: ${status}\n---\n# Finished scope\n`);
		}
		for (const [index, published] of decisions.entries()) {
			expect(yield* daemon.boardQuestions(index === 0 ? "orchestrator" : "automation")).toContain(published.sourcePath);
		}
		expect(yield* daemon.cli(["release", "one", "two"])).toEqual({
			code: 0,
			stderr: "",
			stdout:
				"one waiting (waiting on automation): Answer recorded; applying in the background\ntwo waiting (waiting on automation): Answer recorded; applying in the background",
		});
		for (const workId of ["one", "two"]) {
			expect((yield* daemon.appliedAnswer(workId)).step).toBe("released");
		}
		expect(yield* daemon.boardQuestions()).toEqual([]);
		expect(yield* daemon.boardQuestions("orchestrator")).toEqual([]);
		expect(
			daemon
				.boardAcknowledgements()
				.map((receipt) => receipt?.question)
				.sort((left, right) => String(left).localeCompare(String(right))),
		).toEqual(decisions.map(({ questionId }) => questionId).sort((left, right) => String(left).localeCompare(String(right))));
		for (const published of decisions) {
			expect(daemon.readBoard(`responses/response.fleet-release.${published.questionId}.md`)).toContain("Release Fleet ownership.");
		}
		for (const id of ["one", "two"]) {
			expect(yield* daemon.get(id)).toMatchObject({ responses: [{ action: "release", boardAcknowledged: true }], step: "released" });
		}
		expect(yield* daemon.cli(["release", "one", "two"])).toEqual({ code: 0, stderr: "", stdout: "one released\ntwo released" });
		expect(
			daemon
				.boardAcknowledgements()
				.map((receipt) => receipt?.question)
				.sort((left, right) => String(left).localeCompare(String(right))),
		).toEqual(decisions.map(({ questionId }) => questionId).sort((left, right) => String(left).localeCompare(String(right))));
		expect(daemon.providerLaunches()).toEqual([
			(yield* daemon.get("one")).attempts[0]?.operationId,
			(yield* daemon.get("two")).attempts[0]?.operationId,
		]);
	},
);
