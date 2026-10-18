import type { WorkboardBlock, WorkboardBoard, WorkboardFlight, WorkboardGoal, WorkboardGoalRef } from "#types/index.d.ts";
import { STAGES } from "./answers.ts";

type ReadyBoard = Extract<WorkboardBoard, { kind: "ready" }>;

export interface StageCount {
	count: number;
	stage: string;
}

export interface FlightGroup {
	goal: WorkboardGoalRef | null;
	items: WorkboardFlight[];
}

export function countOf<T>(block: WorkboardBlock<T>): string {
	return block.problem === null ? String(block.items.length) : "?";
}

export function needsYou(board: ReadyBoard): number {
	return board.asks.problem === null ? board.asks.items.length : 0;
}

export function bandLine(board: ReadyBoard): string {
	const { asks, flights, goals } = board;
	let done = 0;
	let total = 0;
	for (const goal of goals.items) {
		done += goal.done;
		total += goal.total;
	}
	const progress = goals.problem === null ? `${done}/${total}` : "?";
	return `Needs you ${countOf(asks)} · In flight ${countOf(flights)} · Goals ${progress}`;
}

export function goalShare(goal: WorkboardGoal): number {
	return goal.total === 0 ? 0 : Math.min(1, goal.done / goal.total);
}

export function startedShare(goal: WorkboardGoal): number {
	return goal.total === 0 ? 0 : Math.min(1, (goal.done + goal.active) / goal.total);
}

function goalRank(goal: WorkboardGoal): number {
	if (goal.total === 0) {
		return 1;
	}
	return goal.done >= goal.total ? 2 : 0;
}

export function goalOrder(goals: readonly WorkboardGoal[]): WorkboardGoal[] {
	return [...goals].sort((a, b) => goalRank(a) - goalRank(b) || goalShare(a) - goalShare(b));
}

export function stageCounts(flights: readonly WorkboardFlight[]): StageCount[] {
	return STAGES.map((stage) => ({ count: flights.filter((flight) => flight.stage === stage).length, stage })).filter((entry) => entry.count > 0);
}

export function flightGroups(flights: readonly WorkboardFlight[]): FlightGroup[] {
	const groups = new Map<string | null, FlightGroup>();
	for (const flight of flights) {
		const id = flight.goal?.id ?? null;
		const group = groups.get(id) ?? { goal: flight.goal, items: [] };
		group.items.push(flight);
		groups.set(id, group);
	}
	const goals = [...groups.values()].filter((group) => group.goal !== null);
	goals.sort((a, b) => b.items.length - a.items.length || (a.goal?.title ?? "").localeCompare(b.goal?.title ?? ""));
	const other = groups.get(null);
	return other === undefined ? goals : [...goals, other];
}
