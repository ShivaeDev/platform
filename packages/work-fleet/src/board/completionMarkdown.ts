import { completionFields } from "#board/completionFields.ts";

export function completionMarkdown(source: string, nextAction: string): string | undefined {
	const opening = /^\uFEFF?---[ \t]*\r?\n/u.exec(source);
	if (opening === null) {
		return;
	}
	const offset = opening[0].length;
	const closing = /^---[ \t]*\r?$/mu.exec(source.slice(offset));
	if (closing === null) {
		return;
	}
	const header = source.slice(offset, offset + closing.index);
	const newline = opening[0].endsWith("\r\n") ? "\r\n" : "\n";
	const edits = completionFields(header, nextAction, newline);
	if (edits === undefined) {
		return;
	}
	let result = source;
	for (const edit of [...edits].sort((left, right) => right.start - left.start)) {
		result = result.slice(0, offset + edit.start) + edit.text + result.slice(offset + edit.end);
	}
	return result;
}
