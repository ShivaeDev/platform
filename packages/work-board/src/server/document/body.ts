import type { MetadataDocument } from "#integration/metadata.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { questionFrom } from "#server/responses/records.ts";

export function documentBody(document: MetadataDocument): string {
	const question = questionFrom(document);
	return question ? metadataParse(question.context).body : document.parsed.body;
}
