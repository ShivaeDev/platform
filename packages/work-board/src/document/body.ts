import type { MetadataDocument } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { questionFrom } from "#responses/records.ts";

export function documentBody(document: MetadataDocument): string {
	const question = questionFrom(document);
	return question ? metadataParse(question.context).body : document.parsed.body;
}
