import type { WatchLine } from "#host/watchAttention.ts";
import type { WatchEvent } from "#host/watchEvents.ts";
import type { WatchState } from "#host/watchState.ts";

export function ordinaryDispatch(reason: string): boolean {
	return /^(?:waiting for (?:dependency |area |open PRs to merge: |\d+ review or repair launches |sweep )|(?:execution|backlog) capacity is occupied \(limit )/u.test(
		reason,
	);
}

export function actionableWork(event: WatchEvent): boolean {
	if (event.kind === "dispatch-failed" && ordinaryDispatch(event.reason ?? "")) {
		return false;
	}
	return true;
}

export function failedDequeue(reason: unknown): boolean {
	return typeof reason === "string" && /fail|error|conflict|timed?_?out|unmergeable/iu.test(reason);
}

export function actionableState(state: WatchState, event: WatchEvent): boolean {
	if (event.kind !== "waiting-on-you" && event.kind !== "waiting-on-orchestrator") {
		return true;
	}
	if (state.stage === "queued" && event.reason === "Board context changed") {
		return false;
	}
	if (state.decision === undefined && /^(?:Waiting for release PR #|Release PR #)/u.test(event.reason ?? "")) {
		const window = state.releaseWindow;
		return window?.reason !== undefined && window.since !== undefined && window.observedAt - window.since >= 5 * 60_000;
	}
	return true;
}

export function quietPrEvent(event: WatchLine): boolean {
	switch (event.kind) {
		case "pr-cooldown":
			return true;
		case "pr-error":
			return event.retryable === true;
		case "pr-stopped":
			return true;
		case "pr-dequeued":
			return !failedDequeue(event.reason);
		default:
			return false;
	}
}
