function lines(text: string) {
	return text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}
function invalid(): never {
	throw new Error("Update diff does not match the reconstructed attachment");
}
interface Hunk {
	readonly body: string[];
	readonly newCount: number;
	readonly newStart: number;
	readonly oldCount: number;
	readonly oldStart: number;
}
function readHunk(line: string): Hunk | undefined {
	const groups = /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@[^\n]*\n?$/u.exec(line)?.groups;
	return groups === undefined
		? undefined
		: {
				body: [],
				newCount: Number(groups.newCount ?? 1),
				newStart: Number(groups.newStart),
				oldCount: Number(groups.oldCount ?? 1),
				oldStart: Number(groups.oldStart),
			};
}
function appendLine(hunk: Hunk, line: string) {
	if (/^\\ No newline at end of file\n?$/u.test(line)) {
		const previous = hunk.body.pop();
		if (previous === undefined || !previous.endsWith("\n")) {
			invalid();
		}
		hunk.body.push(previous.slice(0, -1));
	} else if (/^[ +-]/u.test(line)) {
		hunk.body.push(line);
	} else {
		invalid();
	}
}
function hunks(diff: string) {
	const result: Hunk[] = [];
	let current: Hunk | undefined;
	for (const line of lines(diff)) {
		if (current === undefined && (line.startsWith("--- ") || line.startsWith("+++ "))) {
			continue;
		}
		const header = readHunk(line);
		if (header === undefined) {
			if (current === undefined) {
				invalid();
			}
			appendLine(current, line);
		} else {
			current = header;
			result.push(header);
		}
	}
	if (result.length === 0) {
		invalid();
	}
	return result;
}
function writeHunk(original: string[], output: string[], hunk: Hunk, start: number) {
	let cursor = start;
	let added = 0;
	for (const line of hunk.body) {
		const value = line.slice(1);
		if (!line.startsWith("+")) {
			if (original[cursor] !== value) {
				invalid();
			}
			cursor += 1;
		}
		if (!line.startsWith("-")) {
			output.push(value);
			added += 1;
		}
	}
	if (cursor - start !== hunk.oldCount || added !== hunk.newCount) {
		invalid();
	}
	return cursor;
}
function applyHunk(original: string[], output: string[], hunk: Hunk, cursor: number) {
	const start = hunk.oldCount === 0 ? hunk.oldStart : hunk.oldStart - 1;
	if (start < cursor || start > original.length) {
		invalid();
	}
	for (const line of original.slice(cursor, start)) {
		output.push(line);
	}
	const newStart = hunk.newCount === 0 ? hunk.newStart : hunk.newStart - 1;
	if (newStart !== output.length) {
		invalid();
	}
	return writeHunk(original, output, hunk, start);
}
export function applyReportPatch(content: string, diff: string) {
	if (diff === "") {
		return content;
	}
	const original = lines(content);
	const output: string[] = [];
	let cursor = 0;
	for (const hunk of hunks(diff)) {
		cursor = applyHunk(original, output, hunk, cursor);
	}
	return output.concat(original.slice(cursor)).join("");
}
