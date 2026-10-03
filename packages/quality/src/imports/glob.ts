const STAR = "*";

const GLOBSTAR = "**";

export function wildcardMatches(pattern: string, value: string): boolean {
	const [head = "", ...rest] = pattern.split(STAR);
	const tail = rest.pop();
	if (tail === undefined) {
		return pattern === value;
	}
	const end = value.length - tail.length;
	if (end < head.length || !value.startsWith(head) || !value.endsWith(tail)) {
		return false;
	}
	let at = head.length;
	for (const middle of rest) {
		const found = value.indexOf(middle, at);
		if (found === -1 || found + middle.length > end) {
			return false;
		}
		at = found + middle.length;
	}
	return true;
}

function segmentsMatch(pattern: readonly string[], path: readonly string[]): boolean {
	const [first, ...rest] = pattern;
	if (first === undefined) {
		return path.length === 0;
	}
	if (first === GLOBSTAR) {
		return path.some((_, skipped) => segmentsMatch(rest, path.slice(skipped))) || segmentsMatch(rest, []);
	}
	const [head, ...tail] = path;
	return head !== undefined && wildcardMatches(first, head) && segmentsMatch(rest, tail);
}

export function globMatches(pattern: string, path: string): boolean {
	return segmentsMatch(pattern.split("/"), path.split("/"));
}
