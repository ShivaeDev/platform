import { Effect } from "effect";
import { ReportFileFailure } from "#reportFileFailure.ts";

function lines(text: string) {
	return text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}
function invalid(path: string) {
	return Effect.fail(new ReportFileFailure({ path, reason: "Update diff does not match the reconstructed attachment" }));
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
const appendLine = Effect.fnUntraced(function* (hunk: Hunk, line: string, path: string) {
	if (/^\\ No newline at end of file\n?$/u.test(line)) {
		const previous = hunk.body.pop();
		if (previous === undefined || !previous.endsWith("\n")) {
			return yield* invalid(path);
		}
		hunk.body.push(previous.slice(0, -1));
	} else if (/^[ +-]/u.test(line)) {
		hunk.body.push(line);
	} else {
		return yield* invalid(path);
	}
});
const hunks = Effect.fnUntraced(function* (diff: string, path: string) {
	const result: Hunk[] = [];
	let current: Hunk | undefined;
	for (const line of lines(diff)) {
		if (current === undefined && (line.startsWith("--- ") || line.startsWith("+++ "))) {
			continue;
		}
		const header = readHunk(line);
		if (header === undefined) {
			if (current === undefined) {
				return yield* invalid(path);
			}
			yield* appendLine(current, line, path);
		} else {
			current = header;
			result.push(header);
		}
	}
	if (result.length === 0) {
		return yield* invalid(path);
	}
	return result;
});
const writeHunk = Effect.fnUntraced(function* (original: string[], output: string[], hunk: Hunk, start: number, path: string) {
	let cursor = start;
	let added = 0;
	for (const line of hunk.body) {
		const value = line.slice(1);
		if (!line.startsWith("+")) {
			if (original[cursor] !== value) {
				return yield* invalid(path);
			}
			cursor += 1;
		}
		if (!line.startsWith("-")) {
			output.push(value);
			added += 1;
		}
	}
	if (cursor - start !== hunk.oldCount || added !== hunk.newCount) {
		return yield* invalid(path);
	}
	return cursor;
});
const applyHunk = Effect.fnUntraced(function* (original: string[], output: string[], hunk: Hunk, cursor: number, path: string) {
	const start = hunk.oldCount === 0 ? hunk.oldStart : hunk.oldStart - 1;
	if (start < cursor || start > original.length) {
		return yield* invalid(path);
	}
	for (const line of original.slice(cursor, start)) {
		output.push(line);
	}
	const newStart = hunk.newCount === 0 ? hunk.newStart : hunk.newStart - 1;
	if (newStart !== output.length) {
		return yield* invalid(path);
	}
	return yield* writeHunk(original, output, hunk, start, path);
});
export const applyReportPatch = Effect.fn("Fleet.applyReportPatch")(function* (content: string, diff: string, path = "Attachment") {
	if (diff === "") {
		return content;
	}
	const original = lines(content);
	const output: string[] = [];
	let cursor = 0;
	for (const hunk of yield* hunks(diff, path)) {
		cursor = yield* applyHunk(original, output, hunk, cursor, path);
	}
	return output.concat(original.slice(cursor)).join("");
});
