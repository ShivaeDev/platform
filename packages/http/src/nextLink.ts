export function nextLink(header: string | undefined): string | undefined {
	for (const link of header?.matchAll(/<(?<url>[^>]*)>(?<parameters>(?:[^<",]|"(?:\\.|[^"\\])*")*)/gu) ?? []) {
		const relation = link.groups?.parameters?.match(/(?:^|;)\s*rel\s*=\s*(?:"(?<quoted>[^"]*)"|(?<unquoted>[^;\s,]+))/iu);
		const relations = relation?.groups?.quoted ?? relation?.groups?.unquoted;
		if (relations?.toLowerCase().split(/\s+/u).includes("next")) {
			return link.groups?.url;
		}
	}
	return undefined;
}
