import { linesOf } from "#inventory/linesOf.ts";

export type MarkdownLineKind = "code" | "fence" | "prose";

export interface MarkdownLine {
	readonly kind: MarkdownLineKind;
	readonly language: string;
	readonly number: number;
	readonly text: string;
}

interface OpenFence {
	readonly language: string;
	readonly marker: string;
}

const FENCE = /^ {0,3}(?<marker>`{3,}|~{3,})\s*(?<info>[^`\s]*)[^`]*$/u;

function opening(text: string): OpenFence | undefined {
	const match = FENCE.exec(text);
	const marker = match?.groups?.marker;
	return marker === undefined ? undefined : { language: (match?.groups?.info ?? "").toLowerCase(), marker };
}

function closes(text: string, open: OpenFence): boolean {
	const trimmed = text.trim();
	return trimmed.startsWith(open.marker) && /^(?:`+|~+)$/u.test(trimmed);
}

export function markdownLines(markdown: string): readonly MarkdownLine[] {
	const lines: MarkdownLine[] = [];
	let open: OpenFence | undefined;
	for (const [index, text] of linesOf(markdown).entries()) {
		const number = index + 1;
		if (open === undefined) {
			open = opening(text);
			lines.push({ kind: open === undefined ? "prose" : "fence", language: "", number, text });
		} else if (closes(text, open)) {
			lines.push({ kind: "fence", language: open.language, number, text });
			open = undefined;
		} else {
			lines.push({ kind: "code", language: open.language, number, text });
		}
	}
	return lines;
}

const CODE_SPAN = /(?<ticks>`+)(?<code>.+?)\k<ticks>/gu;

export function codeSpans(text: string): readonly string[] {
	return [...text.matchAll(CODE_SPAN)].map((match) => (match.groups?.code ?? "").trim());
}

export function withoutCodeSpans(text: string): string {
	return text.replace(CODE_SPAN, "");
}
