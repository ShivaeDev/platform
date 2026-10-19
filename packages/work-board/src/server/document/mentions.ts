import { mentionTokens } from "#browser/document/mentions.ts";
import { fileUrl } from "#files/url.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { sourceFile } from "#server/metadata/sourceLinks.ts";

// Agents write next actions like "Waiting on question.x" or "see decisions/y.md"; each token that names one workspace document becomes a reference.
export function documentMentions(text: string | undefined, document: MetadataDocument, model: MetadataModel) {
	if (text === undefined || model.unavailable.length > 0) {
		return [];
	}
	const files = new Map(model.documents.map((entry) => [entry.file, entry]));
	return mentionTokens(text).flatMap((token) => {
		const byId = referenceTarget(token, model) ? model.ids.get(token)?.[0] : undefined;
		const target =
			byId
			?? [sourceFile(token, document.file, model), sourceFile(`/${token}`, document.file, model)]
				.map((file) => (file === undefined ? undefined : files.get(file)))
				.find((entry) => entry !== undefined);
		if (!target || target.file === document.file) {
			return [];
		}
		const id = target.parsed.fields.id;
		const href = (id ? referenceTarget(id, model) : undefined) ?? fileUrl(target.file);
		return [{ href, target, token }];
	});
}
