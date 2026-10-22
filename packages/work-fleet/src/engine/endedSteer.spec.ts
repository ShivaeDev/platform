import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { turnEndsBeforeSteer } from "#test/turnEndsBeforeSteer.ts";

engine.it(
	"a steer rejected after the worker finishes reads its result and reaches independent review without a human",
	[turnEndsBeforeSteer()],
	function* ({ prepareWork, dispatch, reconcile, advanceTime, publishedDecisions }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		yield* reconcile("one");
		advanceTime(31 * 60_000);
		const steered = yield* reconcile("one");
		expect(steered.value.step).toBe("working");
		expect(steered.value.decision).toBeUndefined();
		const reviewed = yield* reconcile("one");
		expect(reviewed.value.step).toBe("reviewing");
		expect(reviewed.value.attempts[0]).toMatchObject({ output: "Completed the approved work", status: "completed" });
		expect(reviewed.value.result?.kind).toBe("change");
		expect(reviewed.value.attempts.at(-1)?.role).toBe("reviewer");
		expect(publishedDecisions()).toEqual([]);
	},
);

engine.it(
	"other steer rejections still surface as integration failures",
	[turnEndsBeforeSteer("TurnMismatch")],
	function* ({ prepareWork, dispatch, reconcile, advanceTime, publishedDecisions }) {
		yield* prepareWork("one");
		yield* dispatch("one");
		yield* reconcile("one");
		advanceTime(31 * 60_000);
		const failed = yield* reconcile("one");
		expect(failed.value.step).toBe("waiting");
		expect(failed.value.decision).toMatchObject({ code: "session-rejected", reason: expect.stringContaining("failed to steer turn: TurnMismatch") });
		expect(publishedDecisions()).toEqual(["Codex rejected the protocol request: failed to steer turn: TurnMismatch"]);
	},
);
