const PROSE_WORD = /^[A-Z]?[a-z]+$/u;
const VALUE_REST = /[^\s"'&,;]*/uy;

// A quoted name, a colon and a word that runs on into a sentence is how diagnostics cite a field path; any other unquoted value may be a secret.
function citesPath(text: string, keyStart: number, separator: string, value: string, end: number): boolean {
	const keyQuote = separator[0];
	if ((keyQuote !== '"' && keyQuote !== "'") || text[keyStart - 1] !== keyQuote || !separator.includes(":") || !PROSE_WORD.test(value)) {
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

export function sensitiveAssignmentValues(text: string, sensitive: (key: string) => boolean): ReadonlyArray<readonly [number, number]> {
	// Names start where a run of name characters starts and unquoted values stop at "=", so each character is scanned a bounded number of times; a value holding "=" is revisited for embedded parameters without reading URL and source-location colons as assignments.
	const matcher =
		/(?<![\w.-])[\d_.-]*(?<key>[A-Za-z][\w.-]*)(?<separator>["']{0,2}\s*[=:]\s*)(?<value>(?<quote>["'])(?:\\[\s\S]?|(?!\k<quote>)[^\\])*(?<closingQuote>\k<quote>|$)|(?=[^\s"'&,;])[^\s"'&,;=]*)/gu;
	const values: Array<readonly [number, number]> = [];
	for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
		const { closingQuote = "", key = "", quote, separator = "", value = "" } = match.groups ?? {};
		const valueStart = matcher.lastIndex - value.length;
		const keyStart = valueStart - separator.length - key.length;
		const secret = sensitive(key);
		const end = quote === undefined && secret ? unquotedEnd(text, matcher.lastIndex) : matcher.lastIndex;
		if (secret && (quote !== undefined || !citesPath(text, keyStart, separator, text.slice(valueStart, end), end))) {
			values.push([valueStart + (quote ?? "").length, end - closingQuote.length]);
			matcher.lastIndex = end;
		} else if (quote === undefined ? text[matcher.lastIndex] === "=" : value.includes("=")) {
			matcher.lastIndex = valueStart;
		}
	}
	return values;
}
