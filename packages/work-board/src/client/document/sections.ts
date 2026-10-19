// Short documents render in one pass; splitting only pays off once parsing would hold the main thread for a noticeable time.
const SPLIT_LENGTH = 16_000;
const TITLE = /^# \S/u;
const DEFINITION = /^ {0,3}\[[^\]\n]+\]:/mu;
const QUESTIONNAIRE = /^ {0,3}:{3,}\s*question\b/mu;
const HEADING = /^#{1,6}(?:[ \t]|$)/u;
const FENCE = /^\s*(?<marker>`{3,}|~{3,})(?<info>.*)$/u;
const DIRECTIVE = /^\s*:{3,}\s*(?<name>[A-Za-z][\w-]*)?/u;
const RAW_BLOCKS: readonly (readonly [RegExp, RegExp])[] = [
	[/^ {0,3}<(?:pre|script|style|textarea)(?:\s|>|$)/iu, /<\/(?:pre|script|style|textarea)>/iu],
	[/^ {0,3}<!--/u, /-->/u],
	[/^ {0,3}<\?/u, /\?>/u],
	[/^ {0,3}<!\[CDATA\[/u, /\]\]>/u],
	[/^ {0,3}<![A-Za-z]/u, />/u],
];
const TAG = /<(?<closing>\/?)(?<name>[A-Za-z][\w-]*)(?=[\s/>])[^>]*?(?<selfClosing>\/?)>/gu;
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

interface Scan {
	blank: boolean;
	directives: number;
	fence: { readonly marker: string; readonly length: number } | undefined;
	rawEnd: RegExp | undefined;
	tags: number;
}

function tagBalance(line: string) {
	let balance = 0;
	for (const { groups } of line.matchAll(TAG)) {
		if (!(VOID.has(groups?.name?.toLowerCase() ?? "") || groups?.selfClosing)) {
			balance += groups?.closing ? -1 : 1;
		}
	}
	return balance;
}

function closesFence(fence: NonNullable<Scan["fence"]>, line: string) {
	const marker = FENCE.exec(line)?.groups;
	return marker?.marker?.[0] === fence.marker && marker.marker.length >= fence.length && !marker.info?.trim();
}

function openBlock(scan: Scan, line: string) {
	const fence = FENCE.exec(line)?.groups;
	if (fence?.marker && !(fence.marker.startsWith("`") && fence.info?.includes("`"))) {
		scan.fence = { length: fence.marker.length, marker: fence.marker[0] ?? "" };
		return;
	}
	for (const [start, end] of RAW_BLOCKS) {
		const opened = start.exec(line);
		if (opened) {
			scan.rawEnd = end.test(line.slice(opened[0].length)) ? undefined : end;
			return;
		}
	}
	const directive = DIRECTIVE.exec(line);
	if (directive) {
		scan.directives = Math.max(0, scan.directives + (directive.groups?.name ? 1 : -1));
	} else if (/^ {0,3}</u.test(line)) {
		scan.tags = Math.max(0, scan.tags + tagBalance(line));
	}
}

function boundary(scan: Scan, line: string) {
	if (scan.fence) {
		scan.fence = closesFence(scan.fence, line) ? undefined : scan.fence;
		return false;
	}
	if (scan.rawEnd) {
		scan.rawEnd = scan.rawEnd.test(line) ? undefined : scan.rawEnd;
		return false;
	}
	const starts = HEADING.test(line) && scan.blank && scan.directives === 0 && scan.tags === 0;
	openBlock(scan, line);
	return starts;
}

// A section boundary must not change what renders, so the split stays outside code, raw HTML and directive blocks, and skips documents
// whose title is not first or whose reference definitions and questionnaires reach across the whole document.
export function documentSections(source: string): readonly string[] {
	if (source.length < SPLIT_LENGTH || !TITLE.test(source.trimStart()) || DEFINITION.test(source) || QUESTIONNAIRE.test(source)) {
		return [source];
	}
	const sections: string[] = [];
	const scan: Scan = { blank: true, directives: 0, fence: undefined, rawEnd: undefined, tags: 0 };
	let start = 0;
	let offset = 0;
	for (const line of source.split("\n")) {
		if (boundary(scan, line) && source.slice(start, offset).trim()) {
			sections.push(source.slice(start, offset));
			start = offset;
		}
		scan.blank = line.trim() === "";
		offset += line.length + 1;
	}
	sections.push(source.slice(start));
	return sections;
}
