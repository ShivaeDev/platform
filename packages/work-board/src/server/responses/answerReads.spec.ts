import { Effect } from "effect";
import { expect } from "vitest";
import { createResponse } from "#client/react/createResponse.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { recordedReads } from "#test/readTraits.ts";

const SOURCE =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";

boardStory.it(
	"saves an answer by rereading only the files it wrote and the asking source",
	[projectFiles({ "notes/first.md": "# First\n", "notes/second.md": "# Second\n", "task.md": SOURCE }), responsesEnabled(), recordedReads()],
	function* ({ client, readFiles }) {
		yield* Effect.promise(() => waitFor(() => expect(readFiles()).toEqual(expect.arrayContaining(["notes/first.md", "notes/second.md", "task.md"]))));
		const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "task.choice", request: "direction" })));
		const before = readFiles().length;
		yield* Effect.promise(() =>
			client.mutate(
				createResponse(client, preview, {
					author: "maintainer",
					body: "Take the first direction.",
					id: "response.first",
					question: preview.id,
					revision: preview.reviewedRevision,
					type: "answer",
				}),
			),
		);
		const reading = yield* Effect.promise(() => client.run(client.responses.responses.run({ question: preview.id })));
		expect(reading.responses.map((saved) => saved.id)).toEqual(["response.first"]);
		const answered = readFiles().slice(before);
		expect(answered).toEqual(expect.arrayContaining([`responses/${preview.id}.md`, "responses/response.first.md"]));
		expect(answered.filter((file) => file !== "task.md" && !file.startsWith("responses/"))).toEqual([]);
	},
);

boardStory.it(
	"saves an answer in a workspace whose changes offer only a full refresh",
	[projectFiles({ "task.md": SOURCE }), responsesEnabled()],
	function* ({ client, answerThroughFullRefresh }) {
		const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "task.choice", request: "direction" })));
		const saved = yield* answerThroughFullRefresh({
			author: "maintainer",
			body: "Take the second direction.",
			id: "response.second",
			item: preview.item,
			request: preview.request,
			revision: preview.reviewedRevision,
			type: "answer",
		});
		expect(saved.id).toBe("response.second");
	},
);
