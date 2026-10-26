import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

for (const activity of [false, true]) {
	isolatedEngine.it(
		`a stalled worker delivers its waiting question after ${activity ? "live activity" : "completion without an answer"}`,
		[markdownWork(), nativeStalledTurn()],
		function* ({ prepareWork, fleet, advanceTime, emitProviderEvent, finishNativeTurn, publishedDocuments, restart }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.reconcile("one");
			advanceTime(31 * 60_000);
			const stalled = yield* fleet.reconcile("one");
			expect(stalled.value.decision?.code).toBe("session-stalled");
			yield* restart();
			expect((yield* fleet.reconcile("one")).value.decision?.id).toBe(stalled.value.decision?.id);
			if (activity) {
				advanceTime(60_000);
				emitProviderEvent();
				const active = yield* fleet.reconcile("one");
				expect(active.value.step).toBe("working");
				expect(active.value.decision).toBeUndefined();
				expect(
					publishedDocuments().find((entry) => entry.file === stalled.value.decision?.published?.sourcePath)?.parsed.fields.attention,
				).toMatchObject([{ state: "closed" }]);
			}
			finishNativeTurn("turn-1", "FLEET_QUESTION: Which deployment region should this worker use?");
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.decision).toMatchObject({
				code: "worker-question",
				reason: "Which deployment region should this worker use?",
				worker: stalled.value.attempts[0]?.receipt,
			});
			const question = publishedDocuments().find((entry) => entry.file === completed.value.decision?.published?.sourcePath)?.parsed;
			expect(question?.body).toContain("Which deployment region should this worker use?");
			expect(question?.fields.attention).toMatchObject([{ responseFrom: ["orchestrator"], state: "open" }]);
			expect(
				publishedDocuments().find((entry) => entry.file === stalled.value.decision?.published?.sourcePath)?.parsed.fields.attention,
			).toMatchObject([{ state: "closed" }]);
		},
	);
}
