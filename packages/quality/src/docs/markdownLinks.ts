import { type MarkdownLine, withoutCodeSpans } from "./markdownLines.ts";

export interface MarkdownLink {
	readonly line: number;
	readonly target: string;
}

const INLINE = /\]\(\s*(?<target><[^>]*>|[^\s)]+)/gu;

const DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(?<target><[^>]*>|\S+)/u;

const ATTRIBUTE = /\b(?:href|src)="(?<target>[^"]+)"/gu;

function unwrapped(target: string): string {
	return target.startsWith("<") && target.endsWith(">") ? target.slice(1, -1) : target;
}

function targetsIn(text: string): readonly string[] {
	const prose = withoutCodeSpans(text);
	const definition = DEFINITION.exec(prose)?.groups?.target;
	return [
		...[...prose.matchAll(INLINE)].map((match) => match.groups?.target ?? ""),
		...(definition === undefined ? [] : [definition]),
		...[...prose.matchAll(ATTRIBUTE)].map((match) => match.groups?.target ?? ""),
	].map(unwrapped);
}

export function markdownLinks(lines: readonly MarkdownLine[]): readonly MarkdownLink[] {
	return lines
		.filter((line) => line.kind === "prose")
		.flatMap((line) => targetsIn(line.text).map((target) => ({ line: line.number, target })))
		.filter((link) => link.target !== "");
}
