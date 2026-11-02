import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { aKeyboardTask, aPreparedHandoff, HANDOFF_RECORD } from "#test/handoffTraits.ts";

for (const file of ["handoffs/damaged.md", "notes/damaged.md"]) {
	for (const value of ["null", "damaged", "{ item: task.keyboard }"]) {
		boardStory.it(
			`a handoff field of ${value} in ${file} leaves its path in unknown history beside a valid handoff`,
			[aKeyboardTask(), aPreparedHandoff()],
			function* ({ edited, handoffHistory }) {
				yield* edited(file, `---\nid: handoff.damaged\nhandoff: ${value}\n---\n# Reviewed direction\n`);

				expect(yield* handoffHistory()).toEqual({ records: ["handoff.keyboard.1 requested"], unreadable: [file] });
			},
		);
	}
}

boardStory.it(
	"repairing an invalid receipt restores the handoff from unknown history to its original history",
	[aKeyboardTask(), aPreparedHandoff()],
	function* ({ agentReportsReceipt, edited, fileText, handoffHistory }) {
		const record = yield* fileText(HANDOFF_RECORD);
		expect(yield* handoffHistory()).toEqual({ records: ["handoff.keyboard.1 requested"], unreadable: [] });
		yield* agentReportsReceipt("damaged");
		expect(yield* handoffHistory()).toEqual({ records: [], unreadable: [HANDOFF_RECORD] });

		yield* edited(HANDOFF_RECORD, record);

		expect(yield* handoffHistory()).toEqual({ records: ["handoff.keyboard.1 requested"], unreadable: [] });
	},
);
