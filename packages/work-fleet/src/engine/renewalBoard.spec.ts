import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported, requiredChecksFailOnce } from "#test/engineTraits.ts";

engine.it(
	"new authored Board context renews SQL work and acknowledges its superseded question",
	[markdownWork(), noChangeReported(), requiredChecksFailOnce()],
	function* (fleet) {
		const source = fleet.boardBrief();
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.finishWorkers();
		const blocked = yield* fleet.reconcile("one");
		const published = blocked.value.decision?.published;
		if (published === undefined) {
			return yield* Effect.die(new Error("Expected a published Board question"));
		}
		const question = fleet.readBoardWork(published.sourcePath);
		expect(yield* fleet.boardInboxFiles()).toContain(published.sourcePath);
		const nextSource = `${source}\n## Approved revised scope\n\nInspect the next independent behavior.\n`;
		fleet.writeBoardWork("one.md", nextSource);
		const renewed = yield* fleet.prepareWork("one");
		expect(renewed.value.workId).toBe("one");
		expect(renewed.value.boardRevision).toBe(briefRevision(metadataParse(nextSource)));
		expect(renewed.value.attempts).toEqual([]);
		expect(renewed.value.result).toBeUndefined();
		expect(renewed.value.history?.[0]?.attempts).toEqual(blocked.value.attempts.map((attempt) => ({ ...attempt, sessionCleanupComplete: true })));
		expect(renewed.value.history?.[0]?.boardContext).toBe(source);
		expect(renewed.value.history?.[0]?.decision?.published).toEqual(published);
		expect(renewed.value.history?.[0]?.decisionAcknowledged).toBe(true);
		expect(yield* fleet.boardInboxFiles()).not.toContain(published.sourcePath);
		expect(fleet.boardReceipts()).toHaveLength(1);
		const closed = metadataParse(fleet.readBoardWork(published.sourcePath));
		expect(closed.fields.attention).toMatchObject([{ state: "closed" }]);
		expect(closed.body).toBe(metadataParse(question).body);
		expect(fleet.readBoardWork("one.md")).toBe(nextSource);
		yield* fleet.restart();

		const restored = yield* fleet.get("one");
		expect(restored.value.history).toEqual(renewed.value.history);
		expect(restored.value.boardContext).toBe(nextSource);
		expect(restored.value.attempts).toEqual([]);
		expect(fleet.boardReceipts()).toHaveLength(1);
		expect(fleet.launches()).toHaveLength(2);
	},
);
