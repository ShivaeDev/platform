export function reasonMarkdown(reason: string): string {
	const source = reason.trim();
	const fenced = /^(?<fence>`{3,}|~{3,})[^\n]*\n(?<reason>[\s\S]*?)\n\k<fence>$/u.exec(source);
	return fenced?.groups?.reason?.trim() ?? source;
}
