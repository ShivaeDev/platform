const TOKENS = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[\w$]+|[?.,;()]/gu;
const SKIP = new Set(["if", "not", "exists", "only", "table"]);
export function sqlTokens(text: string): readonly string[] {
	return [...text.matchAll(TOKENS)]
		.map(([token]) => token)
		.filter((token) => !(token.startsWith("--") || token.startsWith("/*") || token.startsWith("'")));
}

function identifier(token: string): string {
	if (token.startsWith('"')) {
		return token.slice(1, -1).replaceAll('""', '"');
	}
	return /^[a-z_][\w$]*$/iu.test(token) ? token.toLowerCase() : "";
}

export function tableAt(tokens: readonly string[], index: number): string {
	let next = index;
	while (SKIP.has(tokens[next]?.toLowerCase() ?? "")) {
		const only = tokens[next]?.toLowerCase() === "only";
		next += 1;
		if (only && tokens[next] === "(") {
			next += 1;
		}
	}
	const parts = [identifier(tokens[next] ?? "")];
	while (tokens[next + 1] === ".") {
		next += 2;
		parts.push(identifier(tokens[next] ?? ""));
	}
	return parts.includes("") ? "" : parts.join(".");
}
