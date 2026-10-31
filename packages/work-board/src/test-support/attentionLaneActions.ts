import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { Effect } from "effect";
import { STANDING_QUESTION_ID } from "./standingQuestionFixture.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function standingPolicyAnswer(engine: BoardEngine) {
	return Effect.promise(async () => {
		const { client } = served(engine);
		const preview = await client.run(client.responses.question.run({ item: STANDING_QUESTION_ID, request: "policy" }));
		return client.mutate(
			client.responses.answerQuestion.run({
				answers: [{ prompt: "release-policy", selected: ["reviewed"], text: "Include the release notes." }],
				author: "maintainer",
				body: "Apply this policy to future releases.",
				id: `response.${randomUUID()}`,
				item: STANDING_QUESTION_ID,
				request: "policy",
				revision: preview.reviewedRevision,
				type: "answer",
			}),
		);
	});
}

export function runArchive(engine: BoardEngine) {
	return execFileSync(
		process.execPath,
		["--conditions=source", new URL("../server/cli.ts", import.meta.url).pathname, "archive", engine.notes.root],
		{
			encoding: "utf8",
		},
	);
}
