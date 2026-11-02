import { Data, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { answered } from "#answers.ts";

class QueryRejected extends Data.TaggedError("QueryRejected")<{ readonly code: string }> {}

export const answerStory = storyKit({
	create: () => ({}),
	name: "Effect answers",
	stages: [],
	verbs: (_engine, story) => ({
		rejectedQuery: (ending: "fails" | "dies") => {
			story.tell(`a query ${ending} with a refusal carrying a SQLSTATE`);
			const error = new QueryRejected({ code: "42501" });
			return answered(ending === "fails" ? Effect.fail(error) : Effect.die(error), (failure) =>
				failure instanceof QueryRejected ? `SQLSTATE ${failure.code}` : String(failure),
			);
		},
	}),
});
