import { expect } from "vitest";
import { sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("preserves commit and connection release failures when settlement loses its connection", [], function* ({ settlementFailures }) {
	const result = yield* settlementFailures();
	expect(result.error).toMatchObject({
		cause: { cause: new Error("COMMIT connection reset"), code: "RUNTIME.TRANSACTION_COMMIT_FAILED" },
		code: "RUNTIME.TRANSACTION_RELEASE_FAILED",
		releaseError: new Error("connection already terminated"),
	});
	expect(result.calls).toEqual(["commit", "rollback", "release", "destroy"]);
	expect(result.unexpected).toEqual([]);
});
