import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { ResponseInput } from "#client/responses/formSchema.ts";

export function responseAnswers(snapshot: ResponseInput, source: QuestionPreview, prompts: readonly Prompt[]) {
	const changedSource =
		snapshot.answerContext !== JSON.stringify([source.id, source.reviewedRevision])
		&& (snapshot.question !== source.id || snapshot.revision !== source.reviewedRevision);
	return prompts.length > 0
		? prompts.map((prompt) => {
				const answer = snapshot.answers?.find((entry) => entry.prompt === prompt.id);
				return { prompt: prompt.id, selected: changedSource ? [] : (answer?.selected ?? []), text: answer?.text ?? "" };
			})
		: undefined;
}
