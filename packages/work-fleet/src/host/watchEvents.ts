import { waitingOwner } from "#attention.ts";
import type { WatchState } from "#host/watchState.ts";

export const eventKinds = ["waiting-on-orchestrator", "waiting-on-you", "done", "released", "stuck", "dispatch-failed", "answer-failed"] as const;
export type EventKind = (typeof eventKinds)[number];
export interface WatchEvent {
	readonly head?: string;
	readonly kind: EventKind | "daemon-unreachable" | "daemon-back";
	readonly pr?: string;
	readonly reason?: string | undefined;
	readonly workId?: string;
}

interface Observed {
	readonly keys: ReadonlySet<string>;
	readonly progress: number;
	readonly stage: string;
	readonly stuck: boolean;
}

export function watchTransitions(stuckMs: number) {
	const previous = new Map<string, Observed>();
	let initial = true;
	function updateOne(state: WatchState, now: number) {
		const old = previous.get(state.workId);
		const candidates = eventsFor(state);
		const progress = state.progressAt ?? (old?.stage === state.stage ? old.progress : now);
		const stale = ["working", "reviewing"].includes(state.stage) && now - progress >= stuckMs;
		const events = candidates.filter(({ key }) => !old?.keys.has(key)).map(({ event }) => event);
		if (stale && (!old?.stuck || old.progress !== progress)) {
			events.push({
				kind: "stuck",
				reason: `No progress for ${stuckMs / 1000} seconds`,
				workId: state.workId,
				...links(state),
			});
		}
		previous.set(state.workId, {
			keys: new Set(candidates.map(({ key }) => key)),
			progress,
			stage: state.stage,
			stuck: stale,
		});
		return initial ? [] : events;
	}
	return {
		reset: () => {
			previous.clear();
			initial = true;
		},
		update: (states: readonly WatchState[], now: number): readonly WatchEvent[] => {
			const present = new Set(states.map((state) => state.workId));
			for (const id of previous.keys()) {
				if (!present.has(id)) {
					previous.delete(id);
				}
			}
			const events = states.flatMap((state) => updateOne(state, now));
			initial = false;
			return events;
		},
	};
}

function eventsFor(state: WatchState) {
	const events: { event: WatchEvent; key: string }[] = [];
	const event = eventFor(state);
	if (event) {
		events.push({
			event,
			key: JSON.stringify([event, state.decision?.id, state.answerFailure?.id]),
		});
	}
	if (state.dispatch?.status === "failed") {
		const reason = state.dispatch.error ?? "Dispatch failed";
		if (!(reason.startsWith("waiting for dependency ") || reason.startsWith("waiting for area "))) {
			events.push({
				event: {
					...links(state),
					kind: "dispatch-failed",
					reason,
					workId: state.workId,
				},
				key: `dispatch:${state.dispatch.id}`,
			});
		}
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
	if (state.answerFailure) {
		return {
			...base,
			kind: "answer-failed",
			reason: state.answerFailure.error,
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
