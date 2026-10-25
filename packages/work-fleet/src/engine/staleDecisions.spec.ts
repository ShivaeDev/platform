import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { noChangeChecksFailOnce } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const status of ["draft", "deferred"]) {
	engine.it(
		`a Board HTTP release closes a changed and moved ${status} task decision without current approval`,
		[markdownWork(), noChangeChecksFailOnce()],
		function* ({
			boardReceiptRecords,
			moveBoardWork,
			boardInboxFiles,
			recordBoardResponse,
			fleet,
			prepareWork,
			finishWorkers,
			afterRestart,
			launches,
			writeBoardWork,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const decision = (yield* fleet.reconcile("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing decision");
			}
			const published = decision.published;
			expect(yield* boardInboxFiles("orchestrator")).toContain(published.sourcePath);
			writeBoardWork("one.md", `---\nid: one\nkind: task\nstatus: ${status}\n---\n# Changed scope\n`);
			moveBoardWork("one.md", "moved.md");
			const answer = yield* recordBoardResponse({
				answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
				author: "orchestrator",
				body: "Release ownership.",
				id: "response.changed.release",
				question: published.questionId,
				type: "answer",
			});
			const released = yield* fleet.reconcile("one");
			expect(released.value.step).toBe("released");
			if (status === "deferred") {
				expect(released.value.releaseReason).toBe("Board status is deferred");
				expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published }]);
			} else {
				expect(released.value.responses).toMatchObject([{ action: "release", boardAcknowledged: true, responseId: answer.id }]);
			}
			expect(yield* boardInboxFiles()).not.toContain(published.sourcePath);
			expect(yield* boardInboxFiles("orchestrator")).toEqual([]);
			yield* afterRestart(
				Fleet.pipe(Effect.flatMap((resumed) => (status === "deferred" ? resumed.reconcile("one") : resumed.resolve("one", decision.id, answer.id)))),
			);
			expect(boardReceiptRecords()).toMatchObject([
				{ disposition: status === "deferred" ? "superseded" : "applied", question: decision.published.questionId },
			]);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}

engine.it(
	"concurrent retries cannot authorize a changed brief or consume the original answer",
	[markdownWork(), noChangeChecksFailOnce()],
	function* ({
		boardReceiptRecords,
		boardInboxFiles,
		answerReportDecision,
		fleet,
		prepareWork,
		finishWorkers,
		afterRestart,
		launches,
		source,
		writeBoardWork,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const decision = (yield* fleet.reconcile("one")).value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing decision");
		}
		const currentSource = `${source}\nChanged criteria.\n`;
		writeBoardWork("one.md", currentSource);
		const answer = answerReportDecision(decision.published, "retry");
		yield* Effect.all(
			[fleet.resolve("one", decision.id, answer).pipe(Effect.result), fleet.resolve("one", decision.id, answer).pipe(Effect.result)],
			{ concurrency: "unbounded" },
		);
		const prepared = (yield* fleet.get("one")).value;
		expect(prepared.step).toBe("waiting");
		expect(prepared.boardContext).toBe(source);
		expect(prepared.decision).toEqual(decision);
		expect(prepared.responses).toBeUndefined();

		expect(yield* boardInboxFiles()).not.toEqual([]);
		yield* afterRestart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				const denied = yield* restarted.resolve("one", decision.id, answer).pipe(Effect.result);
				expect(denied._tag).toBe("Failure");
				const stopped = yield* restarted.reconcile("one");
				expect(stopped.value.step).toBe("waiting");
				expect(stopped.value.decision?.reason).toBe("Board context changed");
				expect(stopped.value.responses).toBeUndefined();
			}),
		);
		expect(boardReceiptRecords()).toMatchObject([{ disposition: "superseded", question: decision.published.questionId }]);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);
