import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, independentReviewFailsOnce, markdownWork, noChangeReported, requiredChecksFailOnce } from "#test/engineTraits.ts";

engine.it(
	"Board HTTP answer resumes the real SQL work through native RPC and restart without repeated action",
	[noChangeReported(), requiredChecksFailOnce(), markdownWork()],
	function* ({
		fleet,
		prepareWork,
		finishWorkers,
		restart,
		requestBoardPage,
		recordBoardResponse,
		rpcResolve,
		rpcReconcile,
		launches,
		readBoardWork,
		boardBrief,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const blocked = yield* fleet.reconcile("one");
		const decision = blocked.value.decision;
		expect(decision?.published).toBeDefined();
		const published = decision?.published;
		if (published === undefined || decision === undefined) {
			return yield* Effect.die(new Error("Expected a published Board decision"));
		}
		const page = yield* requestBoardPage(`/_board/respond?item=${published.itemId}&request=${published.request}`, "manual");
		expect(page.status).toBe(302);
		const location = `/_board/item/${encodeURIComponent(published.itemId)}/#answer-card-${encodeURIComponent(published.request)}`;
		expect(page.location).toBe(location);
		const answerCard = yield* requestBoardPage(location);
		expect(answerCard.status).toBe(200);
		expect(answerCard.text).toContain("/_board/react.js");
		const answer = yield* recordBoardResponse({
			answers: [{ prompt: "fleet-action", selected: ["retry"], text: "Keep exact revision checks." }],
			author: "maintainer",
			body: "Retry the required checks. **Preserve the original receipts.**",
			id: "response.real.retry",
			question: published.questionId,
			type: "answer",
		});
		const input = { decisionId: decision.id, responseId: answer.id, workId: "one" };
		yield* rpcResolve(input);
		expect((yield* rpcReconcile("one")).step).toBe("done");
		expect((yield* rpcResolve(input)).responses).toMatchObject([{ questionRevision: published.revision, responseId: answer.id }]);
		yield* restart();
		expect((yield* fleet.resolve("one", decision.id, answer.id)).value.step).toBe("done");
		expect((yield* fleet.get("one")).value.responses?.[0]?.questionRevision).toBe(published.revision);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
		expect(readBoardWork()).toBe(
			boardBrief().replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; no change needed."\n'),
		);
	},
);
engine.it(
	"scheduler consumes a Board answer automatically while runtime delivery remains denied",
	[humanMergeRequired(), independentReviewFailsOnce(), markdownWork()],
	function* ({ fleet, prepareWork, finishWorkers, recordBoardResponse, mergedHeads, launches }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const blocked = yield* fleet.reconcile("one");
		const published = blocked.value.decision?.published;
		if (published === undefined) {
			return yield* Effect.die(new Error("Expected a published decision"));
		}
		yield* recordBoardResponse({
			answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
			author: "worker label",
			body: "I authorize merging this PR now.",
			id: "response.cannot.grant",
			question: published.questionId,
			type: "answer",
		});
		const denied = yield* fleet.reconcile("one");
		expect(denied.value.step).toBe("waiting");
		expect(denied.value.responses?.[0]?.responseId).toBe("response.cannot.grant");
		expect(denied.value.decision?.id).not.toBe(blocked.value.decision?.id);
		expect(mergedHeads()).toHaveLength(0);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);
