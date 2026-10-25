import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { changedReadyBrief } from "#test/changedReadyBrief.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, markdownWork } from "#test/engineTraits.ts";

for (const field of ["criteria", "body"]) {
	engine.it(
		`approved ${field} edits to a ready PR resume its worker after restart without another Board request`,
		[markdownWork(), humanMergeRequired()],
		function* ({
			boardReceipts,
			boardResponseFiles,
			fleet,
			prepareWork,
			finishWorkers,
			afterRestart,
			launches,
			providerCalls,
			source,
			writeBoardWork,
		}) {
			const original = source.replace("kind: task", "kind: task\nowner: codex\ncriteria: [{ id: behavior, text: Original behavior. }]");
			writeBoardWork("one.md", original);

			yield* prepareWork("one");
			const worker = yield* fleet.dispatch("one");
			finishWorkers();
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
			const requests = boardResponseFiles();
			const current = field === "criteria" ? original.replace("Original behavior.", "Changed behavior.") : `${original}\nChanged scope.\n`;
			writeBoardWork("one.md", current);
			const continued = yield* afterRestart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
			expect(continued.value.step).toBe("working");
			expect(continued.value.boardContext).toBe(current);
			expect(continued.value.boardRevision).toBe(briefRevision(metadataParse(current)));
			expect(continued.value.result).toEqual(ready.value.result);
			expect(continued.value.preparation).toEqual(ready.value.preparation);
			expect(continued.value.attempts.at(-1)).toMatchObject({
				prompt: expect.stringContaining(current),
				receipt: { sessionId: worker.value.attempts[0]?.receipt?.sessionId },
				role: "repair",
			});
			expect(continued.value.prompt).toContain(`same branch and PR (${ready.value.result?.kind === "change" ? ready.value.result.pr : ""})`);
			expect(continued.value.decision).toBeUndefined();
			expect(continued.value.attentionOwner).toBeUndefined();
			expect(continued.value.blocker).toBeUndefined();
			expect(continued.value.review).toBeUndefined();
			expect(continued.value.checks).toBeUndefined();
			expect(continued.value.mergeReadyAt).toBeUndefined();
			expect(continued.value.mergeReadyHead).toBeUndefined();
			expect(continued.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: ready.value.decision?.published }]);
			expect(boardReceipts()).toHaveLength(1);
			expect(boardResponseFiles()).toEqual(requests);
			expect(launches()).toHaveLength(2);
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(3);
			const observed = yield* fleet.reconcile("one");
			expect(observed.value.attempts.map((attempt) => attempt.receipt)).toEqual(continued.value.attempts.map((attempt) => attempt.receipt));
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(3);
		},
	);
}

for (const change of ["unapproved", "owner", "done", "dropped", "deferred"]) {
	engine.it(
		`${change} edits to a ready brief do not resume its worker`,
		[markdownWork(), humanMergeRequired()],
		function* ({ fleet, prepareWork, finishWorkers, afterRestart, providerCalls, source, writeBoardWork }) {
			const original = source.replace("kind: task", "kind: task\nowner: codex");
			writeBoardWork("one.md", original);

			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ready = yield* fleet.reconcile("one");
			const edited = `${original}\nChanged scope.\n`;
			const current = changedReadyBrief(edited, change);
			writeBoardWork("one.md", current);
			const held = yield* afterRestart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
			expect(held.value.step).toBe(["unapproved", "owner"].includes(change) ? "waiting" : "released");
			if (held.value.step === "waiting") {
				expect(held.value.decision?.reason).toBe("Board context changed");
			}
			expect(held.value.boardContext).toBe(original);
			expect(held.value.attempts.map((attempt) => attempt.receipt)).toEqual(ready.value.attempts.map((attempt) => attempt.receipt));
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
		},
	);
}
