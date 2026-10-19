export interface TextToken {
	readonly index: number;
	readonly kind: "mention" | "pull";
	readonly text: string;
	readonly value: string;
}

// Workspace paths, item IDs and pull request numbers. The lookbehinds keep hosts, paths and fragments inside URLs plain.
const TOKEN = /(?<![\w/.#&-])(?:[\w.-]+(?:\/[\w.-]+)*\.md|[A-Za-z][\w-]*(?:\.[\w-]+)+)(?![\w/-])|(?:\bPR #?|(?<![\w/&#])#)(?<pull>\d+)\b/gu;

export function textTokens(text: string): readonly TextToken[] {
	return [...text.matchAll(TOKEN)].map((match) => {
		const pull = match.groups?.pull;
		return pull === undefined
			? { index: match.index, kind: "mention", text: match[0], value: match[0] }
			: { index: match.index, kind: "pull", text: match[0], value: pull };
	});
}

export function mentionTokens(text: string): readonly string[] {
	return [...new Set(textTokens(text).flatMap((token) => (token.kind === "mention" ? [token.value] : [])))];
}
