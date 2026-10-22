import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { boardStory, deferredServing } from "#test/boardStory.ts";
import { migrationSettledFixture } from "#test/migrationSettledFixture.ts";

boardStory.it(
	"preserves settled receipts, selection-only answers and inbox lanes through vocabulary migration",
	[deferredServing],
	function* ({ readAttention, readInbox, migrate, notes }) {
		const before = yield* readInbox(yield* readAttention(migrationSettledFixture(false)));
		expect([before.you.length, before.answered.length, before.agents.length, before.resolved.length]).toEqual([0, 1, 1, 1]);
		yield* readAttention(migrationSettledFixture(true));
		migrate();
		const files = Object.fromEntries(Object.keys(migrationSettledFixture(true)).map((file) => [file, readFileSync(join(notes.root, file), "utf8")]));
		const after = yield* readInbox(yield* readAttention(files));
		expect([after.you.length, after.answered.length, after.agents.length, after.resolved.length]).toEqual([
			before.you.length,
			before.answered.length,
			before.agents.length,
			before.resolved.length,
		]);
		expect(after.answered[0]?.answered).toMatchObject({ response: "answer.answered", yours: true });
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		const changed = { ...files, "responses/decision.answered.md": `${files["responses/decision.answered.md"]}\nA different question.\n` };
		const edited = yield* readInbox(yield* readAttention(changed));
		expect(edited.you.map((item) => item.id)).toEqual(["task.answered"]);
		expect(edited.answered).toEqual([]);
	},
);
