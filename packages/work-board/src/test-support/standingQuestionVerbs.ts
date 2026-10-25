import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { needsYou } from "#server/mcp/queries.ts";
import { rpcCall } from "./nativeRpc.ts";
import { STANDING_QUESTION_ID } from "./standingQuestionFixture.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function standingQuestionVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		answerStandingQuestion: () =>
			Effect.promise(async () => {
				tell("the maintainer answers the reviewed standing release policy through Board");
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
			}),
		readNeedsYou: () => {
			tell("the agent reads the needs_you plugin tool result");
			return rpcCall(served(engine).board, needsYou);
		},
		readToday: () => {
			tell("the maintainer reads Today's inbox projection");
			return rpcCall(served(engine).board, (client) => client("work-board.inbox", undefined));
		},
	};
}
