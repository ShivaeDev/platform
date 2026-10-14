export function searchSnippet(text: string, term: string): string {
	const source = text.trim();
	if (/^(?:\{|---)/u.test(source) || /(?:^|[\s{,])(?:"[^"\n]+"\s*:|'[^'\n]+':|[a-zA-Z_][\w.-]*:(?:\s|["[{\d]))/u.test(source)) {
		return "";
	}
	const at = Math.max(0, source.toLowerCase().indexOf(term));
	const start = Math.max(0, at - 50);
	return (start ? "…" : "") + source.slice(start, start + 180) + (source.length > start + 180 ? "…" : "");
}
