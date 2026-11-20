const PROSE_WORD = /^[A-Z]?[a-z]+$/u;
const VALUE_REST = /[^\s"'&,;]*/uy;
const KEY_QUOTE = /^\\*["']/u;

// A quoted name, a colon and a word that runs on into a sentence is how diagnostics cite a field path; any other unquoted value may be a secret.
function citesPath(text: string, keyStart: number, separator: string, value: string, end: number): boolean {
	const keyQuote = KEY_QUOTE.exec(separator)?.[0] ?? "";
	if (
		keyQuote === ""
		|| keyStart < keyQuote.length
		|| text.slice(keyStart - keyQuote.length, keyStart) !== keyQuote
		|| !separator.includes(":")
		|| !PROSE_WORD.test(value)
	) {
		return false;
	}
	let next = end;
	while (text[next] === " " || text[next] === "\t") {
		next += 1;
	}
	return next > end && /^[A-Za-z]$/u.test(text[next] ?? "");
}

function unquotedEnd(text: string, from: number): number {
	VALUE_REST.lastIndex = from;
	return VALUE_REST.test(text) ? VALUE_REST.lastIndex : from;
}

function closingQuote(text: string, from: number, quote: string): readonly [number, number] {
	const escapes = quote.length - 1;
	const mark = quote.at(-1);
	let run = 0;
	for (let index = from; index < text.length; index += 1) {
		const character = text[index];
		if (character === mark && run % (2 * escapes + 2) === escapes) {
			return [index - escapes, index + 1];
		}
		run = character === "\\" ? run + 1 : 0;
	}
	return [text.length, text.length];
}

export function sensitiveAssignmentValues(text: string, sensitive: (key: string) => boolean): ReadonlyArray<readonly [number, number]> {
	// Names start where a run of name characters starts, unquoted values stop at "=" and only a secret's quoted value is skipped, so each character is scanned a bounded number of times. Text inside any other quoted value is read on for the names it holds, which is where escaped JSON keeps its keys; a quote may sit behind up to seven backslashes, three levels of escaping. Each level doubles the backslashes before an inner quote and adds one, so a quote closes a value opened behind `escapes` backslashes only when its own run leaves that remainder modulo 2 × (escapes + 1).
	const matcher =
		/(?<![\w.-])[\d_.-]*(?<key>[A-Za-z][\w.-]*)(?<separator>(?:\\{0,7}["']){0,2}\s*[=:]\s*)(?:(?<quote>\\{0,7}["'])|(?<value>(?=[^\s"'&,;])[^\s"'&,;=]*))/gu;
	const values: Array<readonly [number, number]> = [];
	for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
		const { key = "", quote, separator = "", value = "" } = match.groups ?? {};
		const valueStart = matcher.lastIndex - (quote ?? value).length;
		const keyStart = valueStart - separator.length - key.length;
		const secret = sensitive(key);
		if (quote !== undefined) {
			if (secret) {
				const [contentEnd, end] = closingQuote(text, matcher.lastIndex, quote);
				values.push([matcher.lastIndex, contentEnd]);
				matcher.lastIndex = end;
			}
			continue;
		}
		const end = secret ? unquotedEnd(text, matcher.lastIndex) : matcher.lastIndex;
		if (secret && !citesPath(text, keyStart, separator, text.slice(valueStart, end), end)) {
			values.push([valueStart, end]);
			matcher.lastIndex = end;
		} else if (text[matcher.lastIndex] === "=") {
			matcher.lastIndex = valueStart;
		}
	}
	return values;
}
