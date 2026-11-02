import { waitingOwner } from "#attention.ts";
import { actionableState } from "#host/actionableWatch.ts";
import type { WatchState } from "#host/watchState.ts";
import { WAIT_CYCLE } from "#scheduling/adapters/waitCycles.ts";

export const eventKinds = [
	"waiting-on-orchestrator",
	"waiting-on-you",
	"done",
	"released",
	"stuck",
	"dispatch-failed",
	"answer-failed",
	"board-answer",
	"pr-dequeued",
	"pr-stuck",
	"pr-conflict",
	"pr-auto-merge-off",
	"pr-merged",
	"pr-closed",
] as const;
export type EventKind = (typeof eventKinds)[number];
export interface WatchEvent {
	readonly head?: string;
	readonly kind: EventKind | "daemon-unreachable" | "daemon-back";
	readonly pr?: string;
	readonly reason?: string | undefined;
	readonly workId?: string;
}

export const actionableKinds: readonly EventKind[] = [
	"waiting-on-orchestrator",
	"waiting-on-you",
	"stuck",
	"dispatch-failed",
	"answer-failed",
	"pr-dequeued",
	"pr-stuck",
	"pr-conflict",
	"pr-closed",
];

interface Observed {
	readonly progress: number;
	readonly stage: string;
}

export function watchTransitions(stuckMs: number, current = false) {
	const previous = new Map<string, Observed>();
	const seen = new Set<string>();
	let initial = true;
	function unseen(state: WatchState, event: WatchEvent, progress: number) {
		const identity = current ? [] : [state.decision?.id, state.answerFailure?.id, state.dispatch?.id];
		const key = JSON.stringify([event, ...identity, event.kind === "stuck" ? progress : undefined]);
		const duplicate = seen.has(key);
		seen.add(key);
		const visible =
			!initial
			|| (current && actionableKinds.some((kind) => kind === event.kind))
			|| (event.kind === "stuck" && event.reason?.startsWith(WAIT_CYCLE));
		return !duplicate && visible;
	}
	function updateOne(state: WatchState, now: number) {
		const old = previous.get(state.workId);
		const progress = state.progressAt ?? (old?.stage === state.stage ? old.progress : now);
		const candidates = eventsFor(state).filter((event) => !current || actionableState(state, event));
		if (["working", "reviewing"].includes(state.stage) && now - progress >= stuckMs) {
			candidates.push({ kind: "stuck", reason: `No progress for ${stuckMs / 1000} seconds`, workId: state.workId, ...links(state) });
		}
		previous.set(state.workId, { progress, stage: state.stage });
		return candidates.filter((event) => unseen(state, event, progress));
	}
	return {
		reset: () => {
			previous.clear();
			seen.clear();
			initial = true;
		},
		update: (states: readonly WatchState[], now: number): readonly WatchEvent[] => {
			const events = states.flatMap((state) => updateOne(state, now));
			initial = false;
			return events;
		},
	};
}

function eventsFor(state: WatchState): WatchEvent[] {
	const event = eventFor(state);
	const events = event ? [event] : [];
	if (state.dispatch?.status === "failed") {
		events.push({ ...links(state), kind: "dispatch-failed", reason: state.dispatch.error ?? "Dispatch failed", workId: state.workId });
	}
	return events;
}

function links(state: WatchState) {
	return {
		...(state.result?.pr ? { pr: state.result.pr } : {}),
		...(state.result?.head ? { head: state.result.head } : {}),
	};
}

function eventFor(state: WatchState): WatchEvent | undefined {
	const base = { workId: state.workId, ...links(state) };
	if (state.blocker?.startsWith(WAIT_CYCLE)) {
		return { ...base, kind: "stuck", reason: state.blocker };
	}
	if (state.answerFailure || state.blocker?.startsWith("Answer failed: ")) {
		return {
			...base,
			kind: "answer-failed",
			reason: state.answerFailure?.error ?? state.blocker?.slice("Answer failed: ".length),
		};
	}
	if (state.stage === "done" || state.stage === "released") {
		return { ...base, kind: state.stage };
	}
	if (state.dispatch?.status === "failed" && state.blocker?.startsWith("Dispatch failed: ")) {
		return undefined;
	}
	const owner = waitingOwner({ ...state, step: state.stage });
	if (owner === "orchestrator" || owner === "maintainer") {
		return {
			...base,
			kind: owner === "maintainer" ? "waiting-on-you" : "waiting-on-orchestrator",
			reason: state.blocker ?? state.decision?.reason,
		};
	}
	return undefined;
}
