import type { MetadataDocument } from "#metadata/model.ts";
import type { Entry } from "./entries.ts";

export function attentionEntries(document: MetadataDocument, href: string): readonly Entry[] {
	const requests = document.parsed.fields.attention ?? [];
	return requests.flatMap((request, index) => {
		if (requests.filter((other) => other.id === request.id).length !== 1) {
			return [];
		}
		const line = document.parsed.lines[`attention.${index}`] ?? document.parsed.lines.attention;
		return [
			{
				file: document.file,
				href: `${href}#attention-request-${encodeURIComponent(request.id)}`,
				kind: "passage",
				...(line === undefined ? {} : { line }),
				text: [request.reason, request.id, request.kind, request.state, ...request.responseFrom, ...request.unblocks].join(" "),
				title: request.reason,
			},
		];
	});
}
