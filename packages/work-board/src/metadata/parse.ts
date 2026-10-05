import { LineCounter, parseDocument } from "yaml";
import { metadataFields } from "./fields.ts";
import { metadataLocations } from "./locations.ts";
import type { Metadata } from "./schema.ts";

export interface Diagnostic {
	readonly field?: string;
	readonly line: number;
	readonly message: string;
}
export interface ParsedMetadata {
	readonly body: string;
	readonly bodyLine: number;
	readonly diagnostics: readonly Diagnostic[];
	readonly fields: Metadata;
	readonly lines: Readonly<Record<string, number>>;
	readonly raw?: string;
}

export function metadataParse(source: string): ParsedMetadata {
	const plain: ParsedMetadata = { body: source, bodyLine: 1, diagnostics: [], fields: {}, lines: {} };
	const opening = /^\uFEFF?---[ \t]*\r?\n/u.exec(source);
	if (!opening) {
		return plain;
	}
	const remainder = source.slice(opening[0].length);
	const closing = /^---[ \t]*\r?$/mu.exec(remainder);
	if (!closing) {
		return { ...plain, diagnostics: [{ line: 1, message: "Unterminated frontmatter; the original Markdown is shown." }] };
	}
	let end = opening[0].length + closing.index + closing[0].length;
	if (source[end] === "\n") {
		end += 1;
	}
	const raw = source.slice(0, end);
	const body = source.slice(end);
	const bodyLine = raw.split("\n").length;
	const counter = new LineCounter();
	const doc = parseDocument(remainder.slice(0, closing.index), { lineCounter: counter });
	const lines = metadataLocations(doc.contents, counter);
	const diagnostics: Diagnostic[] = [...doc.errors, ...doc.warnings].map((error) => ({
		line: (error.linePos?.[0].line ?? 1) + 1,
		message: error.message,
	}));
	const result = { body, bodyLine, diagnostics, fields: {}, lines, raw };
	if (doc.errors.length > 0 || doc.warnings.length > 0) {
		return result;
	}
	let data: unknown;
	try {
		data = doc.toJS({ maxAliasCount: 50 });
	} catch {
		return { ...result, diagnostics: [...diagnostics, { line: 2, message: "Frontmatter aliases could not be expanded safely." }] };
	}
	if (data === null) {
		return result;
	}
	if (typeof data !== "object" || Array.isArray(data)) {
		return { ...plain, diagnostics: [{ line: 2, message: "Frontmatter must be a mapping; the original Markdown is shown." }] };
	}
	return { ...result, ...metadataFields(data, lines) };
}
