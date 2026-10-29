import type { MarkdownLine } from "./markdownLines.ts";

const ATX = /^ {0,3}#{1,6}\s+(?<title>.*?)(?:\s+#+)?\s*$/u;

const SETEXT = /^ {0,3}(?:=+|-+)\s*$/u;

const HTML_ANCHOR = /<a\s[^>]*\b(?:id|name)="(?<anchor>[^"]+)"/gu;

const LINK = /!?\[(?<text>[^\]]*)\]\([^)]*\)/gu;

const TAG = /<[^>]+>/gu;

const NOT_SLUG = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;

export function headingSlug(title: string): string {
	return title.replace(LINK, "$<text>").replace(TAG, "").replaceAll("`", "").trim().toLowerCase().replace(NOT_SLUG, "").replaceAll(" ", "-");
}

function titleAt(lines: readonly MarkdownLine[], index: number): string | undefined {
	const line = lines[index];
	if (line?.kind !== "prose") {
		return undefined;
	}
	const atx = ATX.exec(line.text)?.groups?.title;
	if (atx !== undefined) {
		return atx;
	}
	const next = lines[index + 1];
	const underlined = next?.kind === "prose" && SETEXT.test(next.text) && line.text.trim() !== "" && !SETEXT.test(line.text);
	return underlined ? line.text.trim() : undefined;
}

// GitHub numbers a repeated heading's anchor -1, -2 and so on, in document order.
export function headingAnchors(lines: readonly MarkdownLine[]): ReadonlySet<string> {
	const anchors = new Set<string>();
	const seen = new Map<string, number>();
	for (const [index, line] of lines.entries()) {
		const title = titleAt(lines, index);
		if (title !== undefined) {
			const slug = headingSlug(title);
			const count = seen.get(slug) ?? 0;
			seen.set(slug, count + 1);
			anchors.add(count === 0 ? slug : `${slug}-${count}`);
		}
		if (line.kind === "prose") {
			for (const match of line.text.matchAll(HTML_ANCHOR)) {
				anchors.add((match.groups?.anchor ?? "").toLowerCase());
			}
		}
	}
	return anchors;
}
