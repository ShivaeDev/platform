import { Cause, Exit } from "effect";
import { expect } from "vitest";
import { sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("rejects a blank SQLite path before opening an ephemeral database", [], function* ({ storage }) {
	const exit = yield* storage.blankPath();
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain(
			"Effect Prisma requires a file-backed SQLite database; transactions run on their own connection and cannot see an in-memory database",
		);
	}
});

sqliteStory.it("honors an empty pragma list without enabling WAL", [], function* ({ storage }) {
	expect(yield* storage.withoutPragmas()).toBe("delete");
});
