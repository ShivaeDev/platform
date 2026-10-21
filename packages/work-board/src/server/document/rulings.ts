import { fileUrl } from "#files/url.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";

export function rulings(document: MetadataDocument, model: MetadataModel, titles: ReadonlyMap<string, string>) {
	const id = document.parsed.fields.id;
	if (!id) {
		return [];
	}
	const index = responseIndex(model);
	return model.documents.flatMap((entry) => {
		const fields = entry.parsed.fields;
		if (
			fields.kind !== "question"
			|| fields.scope !== "standing"
			|| fields.status !== "done"
			|| !fields.relationships?.some((link) => link.target.split("#")[0] === id)
		) {
			return [];
		}
		const answer =
			fields.answer
			?? index
				.questionsFor(fields.id ?? "")
				.flatMap((question) =>
					index
						.responsesFor(question)
						.current.filter((record) => record.response.type === "answer")
						.map((record) => record.body),
				)
				.join("\n\n");
		return answer ? [{ answer, href: fileUrl(entry.file), title: titles.get(entry.file) ?? entry.file }] : [];
	});
}
