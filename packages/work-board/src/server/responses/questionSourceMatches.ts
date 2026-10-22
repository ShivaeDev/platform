import type { Question, QuestionPreview } from "#browser/responses/schema.ts";
import { documentSource, type MetadataDocument } from "#server/metadata/model.ts";
import { migrateSource } from "#server/migration/source.ts";

export function questionSourceMatches(question: Question | QuestionPreview, document: MetadataDocument): boolean {
	const reviewed = "question" in question ? question.question : question;
	if (reviewed.source !== document.file || reviewed.item !== document.parsed.fields.id) {
		return false;
	}
	const source = documentSource(document);
	if (question.context === source) {
		return true;
	}
	const migrated = migrateSource(question.context, {
		answers: new Set(),
		blocking: new Set(document.parsed.fields.urgency === "blocking" ? [reviewed.item] : []),
		file: document.file,
		replaces: [],
	});
	return migrated.fields > 0 && migrated.source === source;
}
