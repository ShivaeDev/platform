function plainText(markdown: string): string {
	return markdown
		.replace(/!?\[(?<label>[^\]\n]*)\]\([^)\n]*\)/gu, "$<label>")
		.replace(/(?<fence>`+)(?<code>.+?)\k<fence>/gu, "$<code>")
		.replace(/(?<marker>\*\*|__|~~)(?=\S)(?<text>.+?)(?<=\S)\k<marker>/gu, "$<text>")
		.replace(/(?<![\p{L}\p{N}*_])(?<marker>[*_])(?=\S)(?<text>.+?)(?<=\S)\k<marker>(?![\p{L}\p{N}*_])/gu, "$<text>");
}

export function searchSnippet(text: string, term: string): string {
	const markdown = text.trim();
	if (/^(?:\{|---)/u.test(markdown) || /(?:^|[\s{,])(?:(?:"[^"\n]+"|'[^'\n]+')\s*:|[a-zA-Z_][\w.-]*\s*:(?:\s|["[{\d]))/u.test(markdown)) {
		return "";
	}
	const source = plainText(markdown);
	const at = Math.max(0, source.toLowerCase().indexOf(term));
	const start = Math.max(0, at - 50);
	return (start ? "…" : "") + source.slice(start, start + 180) + (source.length > start + 180 ? "…" : "");
}
