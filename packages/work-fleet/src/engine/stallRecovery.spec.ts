import { expect } from "vitest";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

for (const delayInterrupt of [false, true]) {
	isolatedEngine.it(
		`stalled turns steer once, interrupt and retry the same thread, then ask the orchestrator: delayed=${delayInterrupt}`,
		[nativeStalledTurn(delayInterrupt)],
		function* ({ nativeRequests, setNativeTurnState, advanceTime, fleet, prepareWork, afterRestart, publishedDecisions }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			advanceTime(31 * 60_000);
			const steered = yield* fleet.reconcile("one");
			expect(nativeRequests().filter((request) => request.method === "turn/steer")).toEqual([
				expect.objectContaining({
					params: {
						expectedTurnId: "turn-1",
						input: [{ text: expect.stringContaining("Continue the approved work"), "text_elements": [], type: "text" }],
						threadId: "worker-thread",
					},
				}),
			]);
			expect(steered.value.attempts[0]?.progress?.at).toBe(0);
			expect(renderStatus(views([steered.value]))).toContain(
				"last progress 1970-01-01T00:00:00.000Z; Fleet steer requested 1970-01-01T00:31:00.000Z",
			);
			yield* afterRestart(fleet.reconcile("one"));
			expect(
				nativeRequests()
					.filter((request) => request.method === "turn/steer")
					.map((request) => request.params),
			).toMatchObject([{ expectedTurnId: "turn-1", threadId: "worker-thread" }]);
			advanceTime(30 * 60_000);
			let retried = yield* fleet.reconcile("one");
			if (delayInterrupt) {
				expect(retried.value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1"]);
				yield* afterRestart(fleet.reconcile("one"));
				setNativeTurnState("turn-1", "interrupted");
				retried = yield* afterRestart(fleet.reconcile("one"));
			}
			expect(retried.value.attempts.map((attempt) => attempt.receipt)).toEqual([
				{ sessionId: "worker-thread", turnId: "turn-1" },
				{ sessionId: "worker-thread", turnId: "turn-2" },
			]);
			expect(nativeRequests().filter((request) => request.method === "turn/interrupt")).toEqual([
				expect.objectContaining({ params: { threadId: "worker-thread", turnId: "turn-1" } }),
			]);
			expect(
				nativeRequests()
					.filter((request) => request.method === "turn/start")
					.at(-1)?.params,
			).toMatchObject({
				input: [{ text: expect.stringContaining("Continue on the same branch and PR") }],
				threadId: "worker-thread",
			});
			expect(
				nativeRequests()
					.filter((request) => request.method === "thread/start")
					.map((request) => request.params),
			).toMatchObject([{ cwd: "/synthetic" }]);
			expect(statusMarkdown([retried.value])).toContain("Fleet interrupt acknowledged 1970-01-01T01:01:00.000Z");
			yield* fleet.reconcile("one");
			advanceTime(31 * 60_000);
			const exhausted = yield* fleet.reconcile("one");
			expect(exhausted.value).toMatchObject({
				attentionOwner: "orchestrator",
				decision: { code: "session-stalled" },
				decisionPublished: true,
				step: "waiting",
			});
			expect(publishedDecisions()).toEqual([exhausted.value.decision?.reason]);
			expect(
				nativeRequests()
					.filter((request) => request.method === "turn/steer")
					.map((request) => request.params),
			).toMatchObject([{ expectedTurnId: "turn-1", threadId: "worker-thread" }]);
		},
	);
}
