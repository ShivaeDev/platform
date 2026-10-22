import { isMap, parseDocument } from "yaml";

export function sourceHeader(source: string) {
	const open = /^\uFEFF?---[^\S\r\n]*\r?\n/u.exec(source);
	if (!open) {
		return undefined;
	}
	const close = /^---[^\S\r\n]*\r?$/mu.exec(source.slice(open[0].length));
	if (!close) {
		return undefined;
	}
	const offset = open[0].length;
	const end = offset + close.index;
	const doc = parseDocument(source.slice(offset, end));
	return isMap(doc.contents) && doc.errors.length === 0 ? { contents: doc.contents, doc, end, offset } : undefined;
}
