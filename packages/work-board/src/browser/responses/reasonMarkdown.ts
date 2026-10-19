export function reasonMarkdown(reason: string): string {
	const source = reason.trim();
	// \x60 spells the backtick because happy-dom's module compiler reads one inside a regex after a minified `return` as a template string, which leaves the bundle's later dynamic imports uncompiled.
	const fenced = /^(?<fence>\x60{3,}|~{3,})[^\n]*\n(?<reason>[\s\S]*?)\n\k<fence>$/u.exec(source);
	return fenced?.groups?.reason?.trim() ?? source;
}
