import type { WorkboardBlock, WorkboardFlight, WorkboardGoal } from "#types/index.d.ts";
import { isRecord, records, text } from "./rpc.ts";

export const STAGES = ["executing", "reviewing", "repairing", "adopting"] as const;
const STAGE_NAMES: ReadonlySet<unknown> = new Set(STAGES);
const DONE = ["done", "completed", "accepted"];
const ACTIVE = [
	"active",
	"running",
	"in-progress",
	"in progress",
	"agent-working",
	"blocked",
	"needs-human",
	"executing",
	"reviewing",
	"repairing",
	"adopting",
];

export function flightsOf(value: unknown, now: number, titles: ReadonlyMap<string, string> = new Map()): WorkboardBlock<WorkboardFlight> {
	if (!isRecord(value)) {
		return { items: [], problem: "Fleet sent no items." };
	}
	if (value.state !== "ready") {
		return { items: [], problem: `Fleet is unavailable: ${text(value.reason) ?? "no reason given"}` };
	}
	const items = records(value.items)
		.filter((row) => STAGE_NAMES.has(row.stage))
		.map((row) => {
			const workId = text(row.workId) ?? "unknown";
			const entered = typeof row.stageEnteredAt === "number" ? row.stageEnteredAt : null;
			const document = isRecord(row.document) ? row.document : {};
			const goalId = goalIdOf(document.metadata, titles);
			return {
				goal: goalId === null ? null : { id: goalId, title: titles.get(goalId) ?? goalId },
				inStageMs: entered === null ? null : Math.max(0, now - entered),
				prUrl: text(row.prUrl) ?? null,
				stage: text(row.stage) ?? "unknown",
				title: text(document.title) ?? workId,
				workId,
			};
		});
	return { items, problem: null };
}

export function goalsOf(value: unknown): WorkboardBlock<WorkboardGoal> {
	const rows = isRecord(value) ? records(value.goals) : [];
	const items = rows.map((row) => {
		const counts = isRecord(row.counts) ? Object.entries(row.counts) : [];
		let done = 0;
		let active = 0;
		let total = 0;
		for (const [status, count] of counts) {
			if (typeof count !== "number") {
				continue;
			}
			total += count;
			if (DONE.includes(status)) {
				done += count;
			} else if (ACTIVE.includes(status)) {
				active += count;
			}
		}
		const id = text(row.id) ?? "goal";
		return { active, done, id, title: text(row.title) ?? id, total };
	});
	return { items, problem: null };
}

function goalIdOf(metadata: unknown, titles: ReadonlyMap<string, string>): string | null {
	const links = isRecord(metadata) ? records(metadata.relationships) : [];
	for (const link of links) {
		const id = link.kind === "implements" ? text(link.target)?.split("#")[0] : undefined;
		if (id !== undefined && (titles.has(id) || id.startsWith("goal."))) {
			return id;
		}
	}
	return null;
}

export function goalTitlesOf(value: unknown): Map<string, string> {
	const titles = new Map<string, string>();
	if (!isRecord(value)) {
		return titles;
	}
	for (const row of [...records(value.goals), ...records(value.closedGoals)]) {
		const id = text(row.id);
		if (id !== undefined) {
			titles.set(id, text(row.title) ?? id);
		}
	}
	return titles;
}
