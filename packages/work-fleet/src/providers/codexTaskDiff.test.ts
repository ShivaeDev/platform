import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { makeCodexTaskDiff } from "#providers/codexTaskDiff.ts";

const RECEIPT = { sessionId: "synthetic/task", turnId: "synthetic-turn" };

it.effect("accepts no attachments when task output items are absent or null", function* () {
	for (const turn of [{ id: RECEIPT.turnId }, { id: RECEIPT.turnId, "output_items": null }]) {
		expect(yield* makeCodexTaskDiff(() => Effect.succeed({ "current_assistant_turn": turn }))(RECEIPT)).toBe("");
	}
});

it.effect("reads flat and nested task diff output and URL-encodes the task identity", function* () {
	const paths: string[] = [];
	const read = makeCodexTaskDiff((path) => {
		paths.push(path);
		return Effect.succeed({
			"current_assistant_turn": {
				id: RECEIPT.turnId,
				"output_items": [
					{ diff: "text", type: "output_diff" },
					{ "output_diff": { diff: "binary" }, type: "pr" },
				],
			},
		});
	});
	expect(yield* read(RECEIPT)).toBe("text\nbinary");
	expect(paths).toEqual(["wham/tasks/synthetic%2Ftask"]);
});

for (const response of [
	{},
	{ "current_assistant_turn": { id: "different-turn", "output_items": [] } },
	{
		"current_assistant_turn": { id: RECEIPT.turnId, "output_items": [] },
		"current_diff_task_turn": { id: "different-turn", "output_items": [{ diff: "old", type: "output_diff" }] },
	},
]) {
	it.effect("refuses missing or mismatched task turns", function* () {
		expect(yield* makeCodexTaskDiff(() => Effect.succeed(response))(RECEIPT).pipe(Effect.flip)).toMatchObject({ reason: "unavailable" });
	});
}
