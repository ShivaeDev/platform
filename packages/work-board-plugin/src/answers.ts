import type { WorkboardBlock, WorkboardFlight, WorkboardGoal } from "#types/index.d.ts";
import { isRecord, records, text } from "./rpc.ts";

export const STAGES = ["working", "reviewing", "waiting"] as const;
const STAGE_NAMES: ReadonlySet<unknown> = new Set(STAGES);

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
				attentionOwner: text(row.attentionOwner),
				goal: goalId === null ? null : { id: goalId, title: titles.get(goalId) ?? goalId },
				inStageMs: entered === null ? null : Math.max(0, now - entered),
				prUrl: text(row.prUrl) ?? null,
				stage: text(row.stage) ?? "unknown",
				title: text(document.title) ?? workId,
				waitingReason: text(row.waitingReason),
				workId,
			};
		});
	return { items, problem: null };
}

export function goalsOf(value: unknown): WorkboardBlock<WorkboardGoal> {
	const rows = isRecord(value) ? records(value.goals) : [];
	const items = rows.map((row) => {
		const counts = isRecord(row.counts) ? row.counts : {};
		function count(state: string) {
			return typeof counts[state] === "number" ? counts[state] : 0;
		}
		const blocked = count("blocked");
		const done = count("done");
		const parked = count("parked");
		const running = count("running");
		const scheduled = count("scheduled");
		const id = text(row.id) ?? "goal";
		return {
			blocked,
			done,
			id,
			parked,
			running,
			scheduled,
			standing: row.standing === true,
			title: text(row.title) ?? id,
			total: blocked + done + parked + running + scheduled,
		};
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
	for (const row of [...records(value.goals), ...records(value.deferredGoals), ...records(value.closedGoals)]) {
		const id = text(row.id);
		if (id !== undefined) {
			titles.set(id, text(row.title) ?? id);
		}
	}
	return titles;
}
