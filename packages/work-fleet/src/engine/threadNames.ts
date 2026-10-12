import { board as boardApi } from "@shivaedev/work-board/integration/board.ts";
import type { Attempt, FleetRecord } from "#model.ts";

function headingAt(line: string, next: string): string | undefined {
	const heading = /^ {0,3}#{1,6}[\t ]+(?<title>.+?)(?:[\t ]+#+)?[\t ]*$/u.exec(line)?.groups?.title;
	if (heading !== undefined) {
		return heading;
	}
	return line.trim() && /^ {0,3}(?:=+|-+)[\t ]*$/u.test(next) ? line.trim() : undefined;
}

function firstHeading(context: string): string | undefined {
	const lines = boardApi.metadataParse(context).body.split(/\r?\n/u);
	let fence: string | undefined;
	for (const [index, line] of lines.entries()) {
		const marker = /^ {0,3}(?<fence>`{3,}|~{3,})/u.exec(line)?.groups?.fence;
		if (marker !== undefined) {
			if (fence === undefined) {
				fence = marker;
			} else if (marker[0] === fence[0] && marker.length >= fence.length) {
				fence = undefined;
			}
			continue;
		}
		if (fence !== undefined) {
			continue;
		}
		const heading = headingAt(line, lines[index + 1] ?? "");
		if (heading !== undefined) {
			return heading;
		}
	}
	return undefined;
}

export function threadName(workId: string, context: string | undefined, role: Attempt["role"]): string {
	const heading = (firstHeading(context ?? "") ?? workId).replace(/\s+/gu, " ").trim();
	const characters = Array.from(heading);
	const title = characters.length > 80 ? `${characters.slice(0, 79).join("").trimEnd()}…` : heading;
	const suffix = { repair: " (repair)", reviewer: " (review)", worker: "" }[role];
	return `${workId}${suffix}: ${title}`;
}

export function recordThreadNames(record: FleetRecord) {
	const cycles = [...(record.history ?? []), record];
	const names = new Map<string, string>();
	for (const cycle of cycles) {
		for (const attempt of cycle.attempts) {
			const sessionId = attempt.receipt?.sessionId ?? attempt.sessionId;
			if (sessionId !== undefined && !names.has(sessionId)) {
				names.set(sessionId, threadName(record.workId, cycle.boardContext, attempt.role));
			}
		}
	}
	return names;
}
