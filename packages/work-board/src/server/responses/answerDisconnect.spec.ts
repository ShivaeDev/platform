import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { createResponse } from "#client/react/createResponse.ts";
import { boardFilesystem, boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { heldRegisteredRead } from "#test/heldRegisteredRead.ts";
import { waitFor } from "#test/live.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";
const held = heldRegisteredRead("task.md");

boardStory.it(
	"finishes saving an answer after the browser goes away mid-save",
	[projectFiles({ "task.md": SOURCE }), responsesEnabled(), boardFilesystem(held.wrap)],
	function* ({ client, notes }) {
		const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "task.choice", request: "direction" })));
		const leaving = new AbortController();
		const saving = client
			.mutate(
				createResponse(client, preview, {
					author: "maintainer",
					body: "Take the first direction.",
					id: "response.leaving",
					question: preview.id,
					revision: preview.reviewedRevision,
					type: "answer",
				}),
				leaving.signal,
			)
			.catch((error: unknown) => error);
		yield* Effect.promise(() => held.started);
		leaving.abort();
		yield* Effect.promise(() => saving);
		yield* Effect.sleep("200 millis");
		held.release();
		yield* Effect.promise(() =>
			waitFor(async () => {
				const saved = await readdir(join(notes.root, "responses"));
				expect(saved).toEqual(expect.arrayContaining([`${preview.id}.md`, "response.leaving.md"]));
			}),
		);
	},
);
