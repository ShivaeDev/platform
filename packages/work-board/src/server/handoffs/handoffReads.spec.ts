import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { recordedReads } from "#test/readTraits.ts";
import { aHandoffTask } from "#test/storyTraits.ts";

const SOURCE =
	"---\nid: task.keyboard\nkind: task\nstatus: in-review\nnext_action: Verify focus before changing the implementation\n---\n# Keyboard focus\n";

boardStory.it(
	"prepares a handoff by rereading only the handoff it wrote",
	[projectFiles({ "notes/first.md": "# First\n", "notes/second.md": "# Second\n" }), aHandoffTask(SOURCE), recordedReads()],
	function* ({ client, handoffDraft, readFiles }) {
		yield* Effect.promise(() => waitFor(() => expect(readFiles()).toEqual(expect.arrayContaining(["notes/first.md", "notes/second.md"]))));
		const draft = yield* handoffDraft();
		const before = readFiles().length;
		const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		const reading = yield* Effect.promise(() => client.run(client.handoffs.handoffs.run({ item: draft.item })));
		expect(reading.records.map((record) => record.id)).toEqual([saved.id]);
		const prepared = readFiles().slice(before);
		expect(prepared).toContain(saved.file);
		expect(prepared.filter((file) => file !== saved.file && file !== draft.source)).toEqual([]);
	},
);
