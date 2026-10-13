import { Effect, Equal } from "effect";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { session } from "#client/entry.ts";
import { responseFailure } from "#client/responses/failure.ts";
import type { ResponseInput, ResponseSubmission } from "#client/responses/formSchema.ts";

export function createResponse(
	source: QuestionPreview,
	submission: ResponseSubmission,
	current: () => ResponseInput | undefined,
	setOutcome: (outcome: string) => void,
	setStatus: (status: string) => void,
) {
	return Effect.tryPromise({
		catch: (error) => error,
		try: async () => {
			const native = session(window);
			setOutcome("pending");
			setStatus("Pending: registering reviewed context, then recording response…");
			try {
				const question = await native.mutate(
					native.responses.registerQuestion.run({ item: source.item, request: source.request, revision: submission.revision }),
				);
				const { answerContext: _answerContext, recovery: _recovery, ...input } = submission;
				await native.mutate(native.responses.recordResponse.run({ ...input, question: question.id }));
				const newer = !Equal.equals(current(), submission);
				setOutcome("saved");
				setStatus(
					`Saved: responses/${submission.id}.md. This records feedback, not acceptance.${newer ? " Your current draft remains unsaved." : ""}`,
				);
				return submission;
			} catch (error) {
				const failure = responseFailure(error);
				setOutcome(failure.outcome);
				setStatus(failure.text);
				throw error;
			}
		},
	});
}
