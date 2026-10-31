import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { responseIndex } from "#server/responseIndex.ts";
import { questionSourceMatches } from "./questionSourceMatches.ts";

export function currentQuestion(document: MetadataDocument, request: string, model: MetadataModel) {
	const questions = responseIndex(model)
		.questionsFor(document.parsed.fields.id ?? "", request)
		.filter(
			(candidate) =>
				model.ids.get(candidate.id)?.length === 1
				&& model.ids.get(candidate.id)?.[0]?.parsed.diagnostics.length === 0
				&& questionSourceMatches(candidate, document),
		);
	return questions.length === 1 ? questions[0] : undefined;
}
