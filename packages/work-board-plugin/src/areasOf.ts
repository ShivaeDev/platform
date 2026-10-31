import { isRecord, records, text } from "#rpc.ts";
import type { WorkboardArea, WorkboardAreaTask, WorkboardBlock } from "#types/index.d.ts";

export function areasOf(value: unknown): WorkboardBlock<WorkboardArea> {
	if (!isRecord(value) || value.state !== "ready") {
		return { items: [], problem: `Fleet is unavailable: ${isRecord(value) ? (text(value.reason) ?? "no reason given") : "no reply"}` };
	}
	if (!Array.isArray(value.areas)) {
		return { items: [], problem: "This Fleet has not supplied area availability." };
	}
	const titles = new Map(records(value.items).map((item) => [text(item.workId), isRecord(item.document) ? text(item.document.title) : undefined]));
	function tasks(entries: unknown): WorkboardAreaTask[] {
		return records(entries).map((entry) => {
			const workId = text(entry.workId) ?? "unknown";
			return { prUrl: text(entry.prUrl) ?? null, stage: text(entry.stage) ?? "unknown", title: titles.get(workId) ?? workId, workId };
		});
	}
	return {
		items: records(value.areas).map((entry) => ({ area: text(entry.area) ?? "unknown", holders: tasks(entry.holders), queue: tasks(entry.queue) })),
		problem: null,
	};
}
