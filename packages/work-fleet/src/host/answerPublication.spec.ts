import { expect } from "@effect/vitest";
import { responses as responsesApi } from "@shivaedev/work-board/server/integration/responses.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const action of ["retry", "release"] as const) {
	host.it(`answer ${action} re-registers a republished decision with a changed template`, [approvedWork(["one"])], function* (daemon) {
		const started = yield* daemon.dispatch("one");
		daemon.finishTurn(started);
		const waiting = yield* daemon.reconcile("one");
		const decision = waiting.decision;
		const published = decision?.published;
		if (decision === undefined || published === undefined) {
			throw new Error("Expected a published decision");
		}
		const context = daemon.readBoard(published.sourcePath).replace("## Recommendation", "## Previous recommendation template");
		const revision = responsesApi.revisionOf(context);
		const questionId = responsesApi.questionId(published.itemId, published.request, revision, published.sourcePath);
		daemon.writeBoard(published.sourcePath, context);
		daemon.writeBoard(
			`responses/${questionId}.md`,
			responsesApi.questionMarkdown({
				context,
				id: questionId,
				question: {
					deadline: 1000,
					item: published.itemId,
					reason: decision.reason,
					registeredAt: 1,
					request: published.request,
					reviewedRevision: revision,
					source: published.sourcePath,
				},
			}),
		);
		yield* daemon.store("one", { ...waiting, decision: { ...decision, published: { ...published, questionId, revision } } });
		const currentContext = context.replace("## Previous recommendation template", "## Current recommendation template");
		daemon.writeBoard(published.sourcePath, currentContext);
		const answered = yield* daemon.answer("one", "", action === "release");
		expect(answered.step).toBe(action === "release" ? "released" : "adopting");
		expect(answered.responses?.at(-1)).toMatchObject({
			action,
			boardAcknowledged: true,
			questionId: responsesApi.questionId(published.itemId, published.request, responsesApi.revisionOf(currentContext), published.sourcePath),
		});
		expect(answered.responses?.at(-1)?.questionId).not.toBe(questionId);
		expect(daemon.receiptFiles()).toHaveLength(1);
	});
}
