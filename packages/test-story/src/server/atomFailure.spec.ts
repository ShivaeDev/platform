import { expect } from "@effect/vitest";
import { atomFailures, failedSource } from "#test/atomFailureStory.ts";

atomFailures.it("an already failed atom reports AtomFailed with the signal name and source reason", [failedSource], function* ({ waitForAnswer }) {
	const outcome = yield* waitForAnswer();

	expect(outcome).toBe("AtomFailed: answer: unavailable");
});

atomFailures.it("a waiting atom reports AtomFailed when its source fails", [], function* ({ beginWaiting, failSource, outcome }) {
	yield* beginWaiting();

	yield* failSource();

	expect(yield* outcome()).toBe("AtomFailed: answer: unavailable");
});
