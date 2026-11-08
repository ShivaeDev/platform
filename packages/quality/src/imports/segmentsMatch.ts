export const GLOBSTAR = "**";

export const DOT = ".";

export type Segment = RegExp | typeof GLOBSTAR;

export function segmentsMatch(pattern: readonly Segment[], path: readonly string[]): boolean {
	const [first, ...rest] = pattern;
	if (first === undefined) {
		return path.length === 0;
	}
	if (first === GLOBSTAR) {
		const hidden = path.findIndex((segment) => segment.startsWith(DOT));
		const reachable = hidden === -1 ? path.length : hidden;
		return [...path.keys(), path.length].some((skipped) => skipped <= reachable && segmentsMatch(rest, path.slice(skipped)));
	}
	const [head, ...tail] = path;
	return head !== undefined && first.test(head) && segmentsMatch(rest, tail);
}
