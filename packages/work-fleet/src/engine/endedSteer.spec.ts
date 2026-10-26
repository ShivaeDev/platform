import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { turnEndsBeforeSteer } from "#test/turnEndsBeforeSteer.ts";

engine.it(
	"a brief steer rejected after the worker finishes reads its result and reaches independent review without a human",
	[markdownWork(), turnEndsBeforeSteer()],
	function* ({ boardBrief, writeBoardWork, prepareWork, dispatch, reconcile, publishedDecisions }) {
		const original = boardBrief().replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
		writeBoardWork("one.md", original);
		yield* prepareWork("one");
		yield* dispatch("one");
		writeBoardWork("one.md", original.replace("Original behavior.", "Changed behavior."));
		const steered = yield* reconcile("one");
		expect(steered.value.step).toBe("working");
		expect(steered.value.decision).toBeUndefined();
		expect(steered.value.attempts[0]?.briefSteers).toEqual([expect.objectContaining({ steeredAt: expect.any(Number) })]);
		const reviewed = yield* reconcile("one");
		expect(reviewed.value.step).toBe("reviewing");
		expect(reviewed.value.attempts[0]).toMatchObject({ output: "Completed the approved work", status: "completed" });
		expect(reviewed.value.result?.kind).toBe("change");
		expect(reviewed.value.attempts.at(-1)?.role).toBe("reviewer");
		expect(publishedDecisions()).toEqual([]);
	},
);

engine.it(
	"other brief steer rejections are recorded as failed deliveries",
	[markdownWork(), turnEndsBeforeSteer("TurnMismatch")],
	function* ({ boardBrief, writeBoardWork, prepareWork, dispatch, reconcile, publishedDecisions }) {
		const original = boardBrief().replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
		writeBoardWork("one.md", original);
		yield* prepareWork("one");
		yield* dispatch("one");
		writeBoardWork("one.md", original.replace("Original behavior.", "Changed behavior."));
		const steered = yield* reconcile("one");
		expect(steered.value.decision).toBeUndefined();
		expect(steered.value.attempts[0]?.briefSteers).toEqual([
			expect.objectContaining({ error: expect.stringContaining("failed to steer turn: TurnMismatch") }),
		]);
		expect(publishedDecisions()).toEqual([]);
	},
);
